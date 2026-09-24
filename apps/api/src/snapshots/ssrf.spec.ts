import { describe, expect, it } from 'vitest';
import { isPublicIp, resolvePublicAddress, UrlGuard } from './ssrf.js';

const fakeResolver =
  (table: Record<string, string[]>) =>
  async (host: string): Promise<string[]> => {
    if (!(host in table)) throw new Error('ENOTFOUND');
    return table[host]!;
  };

describe('isPublicIp', () => {
  it.each([
    ['93.184.215.14', true],
    ['2606:2800:21f:cb07:6820:80da:af6b:8b2c', true],
    ['127.0.0.1', false],
    ['10.1.2.3', false],
    ['172.16.0.1', false],
    ['192.168.1.1', false],
    ['169.254.169.254', false],
    ['100.64.0.1', false],
    ['0.0.0.0', false],
    ['::1', false],
    ['fc00::1', false],
    ['fe80::1', false],
    ['::ffff:127.0.0.1', false],
    ['not-an-ip', false],
  ])('%s → %s', (address, expected) => {
    expect(isPublicIp(address)).toBe(expected);
  });
});

describe('resolvePublicAddress', () => {
  const resolve = fakeResolver({
    'public.test': ['93.184.215.14'],
    'internal.test': ['10.0.0.8'],
    'mixed.test': ['93.184.215.14', '127.0.0.1'],
  });

  it('returns the address of a public host', async () => {
    await expect(resolvePublicAddress('public.test', resolve)).resolves.toBe('93.184.215.14');
  });

  it('rejects a host that resolves to a private address', async () => {
    await expect(resolvePublicAddress('internal.test', resolve)).resolves.toBeNull();
  });

  it('rejects a host with any private address among public ones', async () => {
    await expect(resolvePublicAddress('mixed.test', resolve)).resolves.toBeNull();
  });

  it('rejects unresolvable hosts', async () => {
    await expect(resolvePublicAddress('nowhere.test', resolve)).resolves.toBeNull();
  });

  it('checks IP literals without resolving them', async () => {
    await expect(resolvePublicAddress('[::1]', resolve)).resolves.toBeNull();
    await expect(resolvePublicAddress('93.184.215.14', resolve)).resolves.toBe('93.184.215.14');
  });
});

describe('UrlGuard', () => {
  const guard = new UrlGuard(fakeResolver({ 'shop.test': ['93.184.215.14'] }));

  it.each([
    ['https://shop.test/pricing', true],
    ['http://shop.test', true],
    ['https://shop.test:443/', true],
    ['https://shop.test:8443/', false],
    ['ftp://shop.test', false],
    ['https://user:pass@shop.test', false],
    ['http://127.0.0.1', false],
    ['http://2130706433', false],
    ['http://0x7f.1', false],
    ['javascript:alert(1)', false],
    ['not a url', false],
  ])('%s → %s', async (url, expected) => {
    await expect(guard.isAllowed(url)).resolves.toBe(expected);
  });
});
