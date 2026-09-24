import { describe, expect, it } from 'vitest';
import { goalTargetSchema, matchesPageview } from './goals.js';

describe('matchesPageview', () => {
  const url = 'https://shop.example.com/checkout/thanks/?order=42#top';

  it.each([
    [{ match: 'exact', value: '/checkout/thanks?order=42' }, true],
    [{ match: 'exact', value: '/checkout/thanks' }, false],
    [{ match: 'prefix', value: '/checkout' }, true],
    [{ match: 'prefix', value: '/cart' }, false],
    [{ match: 'prefix', value: 'https://shop.example.com/checkout' }, true],
    [{ match: 'exact', value: 'https://shop.example.com/checkout/thanks/?order=42' }, true],
    [{ match: 'regex', value: 'order=\\d+' }, true],
    [{ match: 'regex', value: '^https://other\\.com' }, false],
  ] as const)('%o → %s', (target, expected) => {
    expect(matchesPageview(target, url)).toBe(expected);
  });

  it('treats a trailing slash and the hash as insignificant', () => {
    expect(
      matchesPageview({ match: 'exact', value: '/pricing' }, 'https://a.com/pricing/#faq'),
    ).toBe(true);
  });

  it('never throws on bad input', () => {
    expect(matchesPageview({ match: 'regex', value: '([' }, url)).toBe(false);
    expect(matchesPageview({ match: 'exact', value: '/' }, 'not a url')).toBe(false);
  });
});

describe('goalTargetSchema', () => {
  it('rejects invalid regexes and event names', () => {
    expect(
      goalTargetSchema.safeParse({ kind: 'pageview', match: 'regex', value: '([' }).success,
    ).toBe(false);
    expect(goalTargetSchema.safeParse({ kind: 'event', eventName: 'has space' }).success).toBe(
      false,
    );
    expect(
      goalTargetSchema.safeParse({ kind: 'event', eventName: 'checkout:complete' }).success,
    ).toBe(true);
  });
});
