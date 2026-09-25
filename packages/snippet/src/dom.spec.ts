// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { applyText, hideConsentBanners, restoreText, showConsentBanners } from './dom';

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('applyText / restoreText', () => {
  it('replaces plain text', () => {
    document.body.innerHTML = '<h1 id="t">Old headline</h1>';
    const el = document.getElementById('t')!;
    applyText(el, 'New headline');
    expect(el.textContent).toBe('New headline');
    restoreText(el);
    expect(el.textContent).toBe('Old headline');
  });

  it('keeps icons and markup inside the element', () => {
    document.body.innerHTML = '<a id="cta"><svg class="icon"></svg> Start <b>now</b> </a>';
    const el = document.getElementById('cta')!;
    applyText(el, 'Try it free');
    expect(el.querySelector('svg.icon')).not.toBeNull();
    expect(el.textContent).toBe(' Try it free  ');
    restoreText(el);
    expect(el.textContent).toBe(' Start now ');
    expect(el.querySelector('b')?.textContent).toBe('now');
  });

  it('uses the value of input buttons', () => {
    document.body.innerHTML = '<input id="b" type="submit" value="Send">';
    const el = document.getElementById('b') as HTMLInputElement;
    applyText(el, 'Get my quote');
    expect(el.value).toBe('Get my quote');
    restoreText(el);
    expect(el.value).toBe('Send');
  });

  it('can be applied twice and still restore the original', () => {
    document.body.innerHTML = '<p id="p">Original</p>';
    const el = document.getElementById('p')!;
    applyText(el, 'A');
    applyText(el, 'B');
    restoreText(el);
    expect(el.textContent).toBe('Original');
  });
});

describe('hideConsentBanners', () => {
  it('hides known consent managers with a stylesheet', () => {
    document.body.innerHTML = '<div id="onetrust-consent-sdk">Cookies</div>';
    hideConsentBanners(document);
    expect(document.getElementById('uplift-hide-consent')?.textContent).toContain(
      '#onetrust-consent-sdk',
    );
  });

  it('hides fixed elements that mention cookies, but not in-flow content', () => {
    document.body.innerHTML = `
      <div id="bar" class="cookie-bar" style="position: fixed">We use cookies</div>
      <section id="policy" class="cookie-policy">Read our cookie policy</section>`;
    expect(hideConsentBanners(document)).toBe(1);
    expect(document.getElementById('bar')!.style.display).toBe('none');
    expect(document.getElementById('policy')!.style.display).toBe('');
    showConsentBanners(document);
    expect(document.getElementById('bar')!.style.display).toBe('');
    expect(document.getElementById('uplift-hide-consent')).toBeNull();
  });

  it('unlocks scrolling locked by a consent wall', () => {
    document.body.style.overflow = 'hidden';
    hideConsentBanners(document);
    expect(document.body.style.overflow).toBe('');
  });
});
