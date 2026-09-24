import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PinnedProxy } from './pinned-proxy.js';

/** Sends a raw CONNECT through the proxy and returns the status line it answers with. */
function connectThrough(proxyUrl: string, target: string, auth?: string) {
  const { port } = new URL(proxyUrl);
  return new Promise<string>((resolve, reject) => {
    const socket = net.connect(Number(port), '127.0.0.1');
    socket.once('error', reject);
    socket.once('data', (data) => {
      resolve(data.toString().split('\r\n')[0]!);
      socket.destroy();
    });
    const authHeader = auth
      ? `Proxy-Authorization: Basic ${Buffer.from(auth).toString('base64')}\r\n`
      : '';
    socket.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n${authHeader}\r\n`);
  });
}

describe('PinnedProxy', () => {
  // A local server stands in for the "public" upstream, so tests never touch the internet.
  let upstream: net.Server;
  let upstreamPort: number;
  let proxy: PinnedProxy;
  let proxyUrl: string;
  const dialed: string[] = [];
  let lookups = 0;

  beforeAll(async () => {
    upstream = net.createServer((socket) => socket.end());
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    upstreamPort = (upstream.address() as net.AddressInfo).port;

    // A rebinding DNS server: public on the first lookup, loopback on every later one.
    const rebindingResolver = async (host: string) => {
      if (host !== 'rebind.test') return host === 'internal.test' ? ['10.0.0.8'] : [];
      lookups++;
      return lookups === 1 ? ['93.184.215.14'] : ['127.0.0.1'];
    };
    proxy = new PinnedProxy(rebindingResolver, (address) => {
      dialed.push(address);
      return net.connect(upstreamPort, '127.0.0.1');
    });
    proxyUrl = await proxy.listen();
  });

  afterAll(async () => {
    await proxy.close();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  });

  const auth = () => `${proxy.username}:${proxy.password}`;

  it('requires credentials', async () => {
    await expect(connectThrough(proxyUrl, 'rebind.test:443')).resolves.toMatch(/ 407 /);
    await expect(connectThrough(proxyUrl, 'rebind.test:443', 'uplift:wrong')).resolves.toMatch(
      / 407 /,
    );
  });

  it('challenges with Basic auth, which browsers need before sending credentials', async () => {
    const { port } = new URL(proxyUrl);
    const response = await new Promise<string>((resolve) => {
      const socket = net.connect(Number(port), '127.0.0.1');
      socket.once('data', (data) => {
        resolve(data.toString());
        socket.destroy();
      });
      socket.write('CONNECT rebind.test:443 HTTP/1.1\r\nHost: rebind.test:443\r\n\r\n');
    });
    expect(response).toMatch(/Proxy-Authenticate: Basic/);
  });

  it('refuses hosts that resolve to internal addresses', async () => {
    await expect(connectThrough(proxyUrl, 'internal.test:443', auth())).resolves.toMatch(/ 403 /);
    await expect(connectThrough(proxyUrl, '127.0.0.1:443', auth())).resolves.toMatch(/ 403 /);
    await expect(connectThrough(proxyUrl, '[::1]:443', auth())).resolves.toMatch(/ 403 /);
  });

  it('only tunnels to the HTTPS port', async () => {
    await expect(connectThrough(proxyUrl, '93.184.215.14:22', auth())).resolves.toMatch(/ 403 /);
  });

  it('connects to the address it validated, so DNS rebinding cannot redirect it', async () => {
    dialed.length = 0;
    lookups = 0;
    await expect(connectThrough(proxyUrl, 'rebind.test:443', auth())).resolves.toMatch(/ 200 /);
    // One lookup, and the connection goes to exactly the public address that passed the check.
    expect(lookups).toBe(1);
    expect(dialed).toEqual(['93.184.215.14']);
  });
});
