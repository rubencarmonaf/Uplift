import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const ALLOWED_PORTS = new Set(['', '80', '443']);

/** True for globally routable unicast addresses; false for loopback, private, link-local, metadata… */
export function isPublicIp(address: string) {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}

/**
 * Guards server-side requests to user-provided URLs (SSRF): only http(s) on standard ports,
 * and every address the hostname resolves to must be public. Lookups are cached per instance,
 * so create one guard per rendering job.
 *
 * Known limit: the address is checked before the request is made, so a DNS answer that changes
 * in between (DNS rebinding) is not caught. Pinning resolved IPs would need a custom proxy.
 */
export class UrlGuard {
  private readonly cache = new Map<string, Promise<boolean>>();

  async isAllowed(rawUrl: string) {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return false;
    }
    if (!ALLOWED_PROTOCOLS.has(url.protocol) || !ALLOWED_PORTS.has(url.port)) return false;
    if (url.username || url.password) return false;

    const host = url.hostname.replace(/^\[|\]$/g, '');
    let result = this.cache.get(host);
    if (!result) {
      result = this.resolvesToPublic(host);
      this.cache.set(host, result);
    }
    return result;
  }

  private async resolvesToPublic(host: string) {
    if (ipaddr.isValid(host)) return isPublicIp(host);
    try {
      const addresses = await lookup(host, { all: true, verbatim: true });
      return addresses.length > 0 && addresses.every((a) => isPublicIp(a.address));
    } catch {
      return false;
    }
  }
}
