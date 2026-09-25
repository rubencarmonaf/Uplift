/**
 * DOM helpers shared by the preview (inside the app) and the production snippet (on customer
 * sites). No dependencies: everything here ends up in small browser bundles.
 */

const originals = new WeakMap<Element, string[]>();

function textNodesOf(el: Element) {
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.textContent && node.textContent.trim()
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP,
  });
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  return nodes;
}

/**
 * Replaces the visible text of `el` while keeping its markup (icons, inline elements): the new
 * text goes into the first text node, keeping its surrounding whitespace, and the others are emptied.
 * Inputs and buttons with a value are handled through their value.
 */
export function applyText(el: Element, text: string) {
  if (el instanceof HTMLInputElement) {
    if (!originals.has(el)) originals.set(el, [el.value]);
    el.value = text;
    return;
  }
  const nodes = textNodesOf(el);
  if (!originals.has(el))
    originals.set(
      el,
      nodes.map((n) => n.textContent ?? ''),
    );
  if (nodes.length === 0) {
    el.appendChild(el.ownerDocument.createTextNode(text));
    return;
  }
  const first = nodes[0]!;
  const [, lead = '', trail = ''] = /^(\s*)[\s\S]*?(\s*)$/.exec(first.textContent ?? '') ?? [];
  first.textContent = lead + text + trail;
  for (const node of nodes.slice(1)) node.textContent = '';
}

/** Undoes `applyText`. */
export function restoreText(el: Element) {
  const saved = originals.get(el);
  if (!saved) return;
  if (el instanceof HTMLInputElement) {
    el.value = saved[0] ?? '';
  } else {
    textNodesOf(el).forEach((node, i) => {
      if (i < saved.length) node.textContent = saved[i]!;
    });
    // Nodes emptied by applyText are no longer found by textNodesOf; restore them by position.
    const all: Text[] = [];
    const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) all.push(n as Text);
    let i = 0;
    for (const node of all) {
      if (i >= saved.length) break;
      if (node.textContent === '' || node.textContent === saved[i]) node.textContent = saved[i++]!;
    }
  }
  originals.delete(el);
}

export function queryOne(doc: Document, selector: string): Element | null {
  try {
    return doc.querySelector(selector);
  } catch {
    return null;
  }
}

/** Consent managers seen on most sites; hidden by id or class, never removed. */
const CONSENT_SELECTORS = [
  '#onetrust-consent-sdk',
  '#onetrust-banner-sdk',
  '#CybotCookiebotDialog',
  '#CybotCookiebotDialogBodyUnderlay',
  '#didomi-host',
  '#usercentrics-root',
  '#usercentrics-cmp-ui',
  '.qc-cmp2-container',
  '#qc-cmp2-container',
  '#truste-consent-track',
  '.truste_box_overlay',
  '#cookiescript_injected',
  '.cc-window',
  '.cc-banner',
  '#cookie-law-info-bar',
  '.cky-consent-container',
  '.cky-overlay',
  '#axeptio_overlay',
  '#iubenda-cs-banner',
  '.osano-cm-window',
  '#klaro',
  '[id^="sp_message_container"]',
  '#cmpbox',
  '#cmpbox2',
  '.fc-consent-root',
  '#hs-eu-cookie-confirmation',
  '#CookieConsent',
  '.cookieconsent',
  '#cookie-notice',
  '.cookie-notice',
  '#gdpr-cookie-message',
];

const CONSENT_HINT = /cookie|consent|gdpr|\bcmp\b|privacy-banner/i;
const STYLE_ID = 'uplift-hide-consent';

/**
 * Hides cookie/consent banners so they don't cover the page: known consent managers by selector,
 * plus fixed or sticky elements whose id, class or label mentions cookies or consent.
 * Returns how many elements were hidden.
 */
export function hideConsentBanners(doc: Document) {
  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `${CONSENT_SELECTORS.join(',')}{display:none!important}`;
    (doc.head ?? doc.documentElement).appendChild(style);
  }
  let hidden = 0;
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>('body *'))) {
    const label = `${el.id} ${typeof el.className === 'string' ? el.className : ''} ${el.getAttribute('aria-label') ?? ''}`;
    if (!CONSENT_HINT.test(label)) continue;
    const position = doc.defaultView?.getComputedStyle(el).position;
    if (position !== 'fixed' && position !== 'sticky') continue;
    el.setAttribute('data-uplift-hidden', '');
    el.style.setProperty('display', 'none', 'important');
    hidden++;
  }
  // Consent walls often lock scrolling on the page behind them.
  for (const root of [doc.documentElement, doc.body]) {
    if (root && root.style.overflow === 'hidden') root.style.removeProperty('overflow');
  }
  return hidden;
}

/** Undoes `hideConsentBanners`. */
export function showConsentBanners(doc: Document) {
  doc.getElementById(STYLE_ID)?.remove();
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>('[data-uplift-hidden]'))) {
    el.removeAttribute('data-uplift-hidden');
    el.style.removeProperty('display');
  }
}
