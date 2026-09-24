import { randomBytes, timingSafeEqual } from 'node:crypto';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import net from 'node:net';
import type { Duplex } from 'node:stream';
import { type Resolver, resolvePublicAddress } from './ssrf.js';

const TUNNEL_PORTS = new Set([443]);
const HTTP_PORTS = new Set([80]);
const IDLE_TIMEOUT_MS = 30_000;

/**
 * A local forward proxy the headless browser sends all its traffic through. For each connection
 * it resolves the target host once, checks that the address is public and connects to *that*
 * address, so a DNS answer that changes between the check and the connection (DNS rebinding)
 * can no longer reach internal services.
 *
 * Listens on loopback only and requires credentials, so other local processes cannot use it.
 */
export class PinnedProxy {
  private readonly server: http.Server;
  private readonly sockets = new Set<Duplex>();
  readonly username = 'uplift';
  readonly password = randomBytes(24).toString('base64url');
  private readonly expectedAuth = Buffer.from(
    `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
  );

  constructor(
    private readonly resolve?: Resolver,
    /** Opens the upstream TCP connection; injectable so tests can observe which address is used. */
    private readonly dial: (address: string, port: number) => net.Socket = (host, port) =>
      net.connect({ host, port }),
  ) {
    this.server = http.createServer((req, res) => void this.onRequest(req, res));
    this.server.on('connect', (req, socket, head) => void this.onConnect(req, socket, head));
    this.server.on('connection', (socket) => {
      this.sockets.add(socket);
      socket.on('close', () => this.sockets.delete(socket));
    });
  }

  async listen() {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    const { port } = this.server.address() as net.AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  async close() {
    for (const socket of this.sockets) socket.destroy();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private authorized(req: IncomingMessage) {
    const header = Buffer.from(req.headers['proxy-authorization'] ?? '');
    return header.length === this.expectedAuth.length && timingSafeEqual(header, this.expectedAuth);
  }

  /** HTTPS: `CONNECT host:443`, then a raw tunnel to the validated address. */
  private async onConnect(req: IncomingMessage, client: Duplex, head: Buffer) {
    client.on('error', () => client.destroy());
    if (!this.authorized(req)) return reject(client, 407);

    const match = /^(\[[^\]]+\]|[^:]+):(\d+)$/.exec(req.url ?? '');
    const port = Number(match?.[2]);
    if (!match || !TUNNEL_PORTS.has(port)) return reject(client, 403);

    const address = await resolvePublicAddress(match[1]!, this.resolve);
    if (!address) return reject(client, 403);

    const upstream = this.dial(address, port);
    upstream.setTimeout(IDLE_TIMEOUT_MS, () => upstream.destroy());
    upstream.once('connect', () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });
    upstream.on('error', () => reject(client, 502));
    client.on('close', () => upstream.destroy());
  }

  /** Plain HTTP: the browser sends the absolute URL; forward it to the validated address. */
  private async onRequest(req: IncomingMessage, res: ServerResponse) {
    if (!this.authorized(req)) {
      res.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="uplift"' }).end();
      return;
    }
    let target: URL;
    try {
      target = new URL(req.url ?? '');
    } catch {
      res.writeHead(400).end();
      return;
    }
    const port = Number(target.port || 80);
    if (target.protocol !== 'http:' || !HTTP_PORTS.has(port)) {
      res.writeHead(403).end();
      return;
    }
    const address = await resolvePublicAddress(target.hostname, this.resolve);
    if (!address) {
      res.writeHead(403).end();
      return;
    }

    const headers: http.OutgoingHttpHeaders = { ...req.headers, host: target.host };
    delete headers['proxy-authorization'];
    delete headers['proxy-connection'];
    const upstream = http.request({
      host: address,
      port,
      method: req.method,
      path: target.pathname + target.search,
      headers,
      setHost: false,
      timeout: IDLE_TIMEOUT_MS,
    });
    upstream.on('response', (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    });
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  }
}

function reject(socket: Duplex, status: 403 | 407 | 502) {
  if (!socket.writable) return socket.destroy();
  const reason = { 403: 'Forbidden', 407: 'Proxy Authentication Required', 502: 'Bad Gateway' }[
    status
  ];
  // Browsers only send credentials after being challenged with a supported scheme.
  const challenge = status === 407 ? 'Proxy-Authenticate: Basic realm="uplift"\r\n' : '';
  socket.end(
    `HTTP/1.1 ${status} ${reason}\r\n${challenge}Content-Length: 0\r\nConnection: close\r\n\r\n`,
  );
}
