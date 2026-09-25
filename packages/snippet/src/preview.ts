import { applyText, hideConsentBanners, queryOne, restoreText, showConsentBanners } from './dom';

/**
 * Runs inside the sandboxed snapshot iframe in the app. The app sends which text to show for
 * each element and whether to hide consent banners; the preview answers with which selectors
 * it could not find, so the app can warn about them.
 *
 * `data-hide-consent="true"` on the script tag hides banners from the start (used by the picker).
 */
type ApplyMessage = {
  source: 'uplift-app';
  type: 'preview:apply';
  changes: { selector: string; text: string | null }[];
  hideConsent: boolean;
};

const script = document.currentScript as HTMLScriptElement | null;
const post = (message: Record<string, unknown>) =>
  window.parent.postMessage({ source: 'uplift-preview', ...message }, '*');

const applied = new Set<Element>();

function apply(message: ApplyMessage) {
  const missing: string[] = [];
  const nextApplied = new Set<Element>();
  for (const { selector, text } of message.changes) {
    const el = queryOne(document, selector);
    if (!el) {
      missing.push(selector);
      continue;
    }
    if (text === null) {
      restoreText(el);
    } else {
      applyText(el, text);
      nextApplied.add(el);
    }
  }
  // Elements no longer listed go back to their original copy.
  for (const el of applied) if (!nextApplied.has(el)) restoreText(el);
  applied.clear();
  nextApplied.forEach((el) => applied.add(el));

  if (message.hideConsent) hideConsentBanners(document);
  else showConsentBanners(document);
  post({ type: 'preview:applied', missing });
}

function start() {
  if (script?.dataset.hideConsent === 'true') {
    hideConsentBanners(document);
    // Some banners are injected late; one more pass catches most of them.
    setTimeout(() => hideConsentBanners(document), 500);
  }
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const data = event.data as ApplyMessage | undefined;
    if (data?.source === 'uplift-app' && data.type === 'preview:apply') apply(data);
  });
  post({ type: 'preview:ready' });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
