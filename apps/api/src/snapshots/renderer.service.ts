import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { SnapshotError } from '@uplift/shared';
import { type Browser, chromium, errors } from 'playwright';
import { PinnedProxy } from './pinned-proxy.js';
import { UrlGuard } from './ssrf.js';

const VIEWPORT = { width: 1366, height: 900 };
const NAVIGATION_TIMEOUT_MS = 25_000;
const SETTLE_TIMEOUT_MS = 5_000;
const MAX_HTML_BYTES = 8 * 1024 * 1024;
const MAX_CONCURRENT_RENDERS = 2;

export class SnapshotFailedError extends Error {
  constructor(readonly reason: SnapshotError) {
    super(reason);
  }
}

export type RenderedPage = { finalUrl: string; title: string; html: string };

/** Rewrites relative url(...) and @import references in a stylesheet so it can be inlined in the page. */
export function absolutizeCss(css: string, sheetUrl: string) {
  const resolve = (ref: string) => {
    if (/^(data:|blob:|#)/i.test(ref)) return ref;
    try {
      return new URL(ref, sheetUrl).href;
    } catch {
      return ref;
    }
  };
  return css
    .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (_m, quote: string, ref: string) => {
      return `url(${quote}${resolve(ref.trim())}${quote})`;
    })
    .replace(/@import\s+(['"])([^'"]+)\1/gi, (_m, quote: string, ref: string) => {
      return `@import ${quote}${resolve(ref)}${quote}`;
    });
}

/**
 * Runs in the page after rendering. Produces a static, script-free HTML document whose styles
 * are all inline, so it renders the same without the site's JavaScript.
 */
function serializePage(stylesheets: Record<string, string>) {
  // Styles injected through the CSSOM (CSS-in-JS) are not in the markup: write them back.
  for (const style of Array.from(document.querySelectorAll('style'))) {
    try {
      const rules = style.sheet
        ? Array.from(style.sheet.cssRules, (r) => r.cssText).join('\n')
        : '';
      if (rules.length > (style.textContent ?? '').length) style.textContent = rules;
    } catch {
      // Cross-origin or broken sheet: keep the original text.
    }
  }
  for (const sheet of document.adoptedStyleSheets ?? []) {
    const style = document.createElement('style');
    style.textContent = Array.from(sheet.cssRules, (r) => r.cssText).join('\n');
    document.head.appendChild(style);
  }

  // Inline external stylesheets captured over the network.
  for (const link of Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]'),
  )) {
    const css = stylesheets[link.href];
    if (css === undefined) continue;
    const style = document.createElement('style');
    style.textContent = css;
    if (link.media) style.media = link.media;
    link.replaceWith(style);
  }

  // Remove anything executable or that would reach out on its own.
  document
    .querySelectorAll(
      'script, noscript, iframe, frame, frameset, object, embed, portal, meta[http-equiv], ' +
        'link[rel~="preload"], link[rel~="modulepreload"], link[rel~="prefetch"], ' +
        'link[rel~="preconnect"], link[rel~="dns-prefetch"], link[rel~="manifest"], link[rel~="import"]',
    )
    .forEach((el) => el.remove());
  for (const el of Array.from(document.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      else if (
        ['href', 'src', 'action', 'formaction', 'xlink:href'].includes(name) &&
        /^\s*javascript:/i.test(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
  }
  // Lazy images were loaded while scrolling; make sure they stay eager in the copy.
  document
    .querySelectorAll('img[loading="lazy"]')
    .forEach((img) => img.setAttribute('loading', 'eager'));

  // Resolve relative URLs (images, fonts) against the original page.
  document.querySelectorAll('base').forEach((b) => b.remove());
  const base = document.createElement('base');
  base.href = location.href;
  document.head.prepend(base);

  return {
    title: document.title,
    html: '<!doctype html>\n' + document.documentElement.outerHTML,
  };
}

/** Scrolls through the page so lazy-loaded content and images are rendered. */
async function autoScroll() {
  const step = window.innerHeight * 0.8;
  const limit = Math.min(document.documentElement.scrollHeight, 30_000);
  for (let y = 0; y < limit; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 100));
  }
  window.scrollTo(0, 0);
}

@Injectable()
export class RendererService implements OnModuleDestroy {
  private readonly logger = new Logger(RendererService.name);
  private browser: Promise<Browser> | null = null;
  private proxy: PinnedProxy | null = null;
  private active = 0;
  private readonly queue: (() => void)[] = [];

  async onModuleDestroy() {
    if (this.browser) await (await this.browser).close().catch(() => {});
    await this.proxy?.close();
  }

  async render(url: string): Promise<RenderedPage> {
    const guard = new UrlGuard();
    if (!(await guard.isAllowed(url))) throw new SnapshotFailedError('blocked_url');

    await this.acquire();
    try {
      return await this.renderWith(guard, url);
    } finally {
      this.release();
    }
  }

  private async renderWith(guard: UrlGuard, url: string): Promise<RenderedPage> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      viewport: VIEWPORT,
      serviceWorkers: 'block',
      javaScriptEnabled: true,
      acceptDownloads: false,
    });
    const stylesheets: Record<string, string> = {};
    const pendingSheets: Promise<void>[] = [];

    try {
      // Fast early rejection of disallowed URLs. The actual enforcement, including every redirect
      // hop, is PinnedProxy: the browser can only reach the network through it.
      await context.route('**/*', async (route) => {
        const request = route.request();
        const target = request.url();
        if (/^(data|blob):/i.test(target)) return route.continue();
        if (['media', 'websocket', 'eventsource'].includes(request.resourceType())) {
          return route.abort('blockedbyclient');
        }
        if (!(await guard.isAllowed(target))) return route.abort('blockedbyclient');
        return route.continue();
      });

      const page = await context.newPage();
      page.on('response', (response) => {
        if (response.request().resourceType() !== 'stylesheet' || !response.ok()) return;
        const sheetUrl = response.url();
        pendingSheets.push(
          response
            .text()
            .then((css) => {
              stylesheets[sheetUrl] = absolutizeCss(css, sheetUrl);
            })
            .catch(() => {}),
        );
      });
      let response;
      try {
        response = await page.goto(url, { waitUntil: 'load', timeout: NAVIGATION_TIMEOUT_MS });
      } catch (err) {
        if (err instanceof errors.TimeoutError) throw new SnapshotFailedError('timeout');
        throw new SnapshotFailedError('unreachable');
      }
      if (!response || response.status() >= 400) throw new SnapshotFailedError('unreachable');

      await page.waitForLoadState('networkidle', { timeout: SETTLE_TIMEOUT_MS }).catch(() => {});
      await page.evaluate(autoScroll);
      await page.waitForLoadState('networkidle', { timeout: SETTLE_TIMEOUT_MS }).catch(() => {});
      await Promise.allSettled(pendingSheets);

      const { title, html } = await page.evaluate(serializePage, stylesheets);
      if (Buffer.byteLength(html) > MAX_HTML_BYTES) throw new SnapshotFailedError('too_large');
      return { finalUrl: page.url(), title, html };
    } catch (err) {
      if (!(err instanceof SnapshotFailedError))
        this.logger.warn(`Render failed for ${url}: ${err}`);
      throw err instanceof SnapshotFailedError ? err : new SnapshotFailedError('unreachable');
    } finally {
      await context.close();
    }
  }

  private getBrowser() {
    if (!this.browser) {
      this.browser = this.launch();
      this.browser.catch(() => {
        this.browser = null;
      });
    }
    return this.browser;
  }

  private async launch() {
    this.proxy ??= new PinnedProxy();
    const server = await this.proxy.listen();
    return chromium.launch({
      proxy: {
        server,
        username: this.proxy.username,
        password: this.proxy.password,
        // Chromium sends loopback traffic directly by default; force it through the proxy too.
        bypass: '<-loopback>',
      },
      args: [
        '--disable-dev-shm-usage',
        // WebRTC can open UDP connections that bypass the proxy.
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
        '--webrtc-ip-handling-policy=disable_non_proxied_udp',
      ],
    });
  }

  private async acquire() {
    if (this.active < MAX_CONCURRENT_RENDERS) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
  }

  private release() {
    this.active--;
    this.queue.shift()?.();
  }
}
