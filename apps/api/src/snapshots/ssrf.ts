import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
export const ALLOWED_PORTS = new Set(['', '80', '443']);

/** True for globally routable unicast addresses; false for loopback, private, link-local, metadata… */
export function isPublicIp(address: string) {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}

export type Resolver = (host: string) => Promise<string[]>;

const systemResolver: Resolver = async (host) =>
  (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);

/**
 * Resolves `host` and returns one of its addresses, or null unless *every* address is public
 * (a name that also points inside the network is rejected outright).
 */
export async function resolvePublicAddress(host: string, resolve: Resolver = systemResolver) {
  const bare = host.replace(/^\[|\]$/g, '');
  if (ipaddr.isValid(bare)) return isPublicIp(bare) ? bare : null;
  try {
    const addresses = await resolve(bare);
    if (addresses.length === 0 || !addresses.every(isPublicIp)) return null;
    return addresses[0]!;
  } catch {
    return null;
  }
}

/**
 * First line of defence against SSRF: only http(s) on standard ports to hosts that resolve to
 * public addresses. Lookups are cached per instance, so create one guard per rendering job.
 *
 * On its own this is open to DNS rebinding (the name could resolve differently when the browser
 * connects); the renderer therefore also sends all traffic through PinnedProxy, which connects
 * to the exact address it validated.
 */
export class UrlGuard {
  private readonly cache = new Map<string, Promise<boolean>>();

  constructor(private readonly resolve: Resolver = systemResolver) {}

  async isAllowed(rawUrl: string) {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return false;
    }
    if (!ALLOWED_PROTOCOLS.has(url.protocol) || !ALLOWED_PORTS.has(url.port)) return false;
    if (url.username || url.password) return false;

    let result = this.cache.get(url.hostname);
    if (!result) {
      result = resolvePublicAddress(url.hostname, this.resolve).then((ip) => ip !== null);
      this.cache.set(url.hostname, result);
    }
    return result;
  }
}
