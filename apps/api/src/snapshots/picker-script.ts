/**
 * Runs inside the sandboxed snapshot iframe (opaque origin, no access to the app).
 * It is serialized with `Function.prototype.toString`, so it must be fully self-contained:
 * no imports, no references to anything outside its own body.
 *
 * - Highlights the element under the pointer and disables the page's own clicks.
 * - On click, reports a unique CSS selector, the visible text and a suggested element type.
 * - Outlines the selectors the app sends (elements already added to the project).
 */
export function pickerMain() {
  const post = (message: Record<string, unknown>) =>
    window.parent.postMessage({ source: 'uplift-picker', ...message }, '*');

  // ---------- Selector generation ----------

  const isStableId = (id: string) =>
    /^[A-Za-z][\w-]*$/.test(id) &&
    !/\d{3,}/.test(id) &&
    !/^(radix|react|headlessui|mui|ember|:r)/i.test(id);

  // Skips generated class names (CSS-in-JS hashes, CSS modules) and Tailwind utilities with variants.
  const isStableClass = (name: string) =>
    /^[A-Za-z_][\w-]*$/.test(name) &&
    name.length <= 40 &&
    !/\d{3,}/.test(name) &&
    !/^(css|sc|jsx|svelte|astro|emotion|styled|tw)-/i.test(name) &&
    !/__[A-Za-z0-9]{5,}$/.test(name) &&
    !(/[A-Z]/.test(name) && /\d/.test(name) && name.length <= 12);

  const isUnique = (selector: string) => {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  };

  // Utility classes (Tailwind-style) describe looks, not meaning, and change with every redesign.
  const UTILITY_CLASS =
    /^-?[mp][trblxyse]?-|^(flex|grid|w|h|size|min-w|max-w|min-h|max-h|text|bg|border|rounded|gap|space|items|justify|content|self|place|font|leading|tracking|shadow|opacity|z|top|left|right|bottom|inset|overflow|transition|duration|ease|delay|animate|transform|translate|scale|rotate|origin|cursor|select|order|col|row|basis|grow|shrink|outline|ring|fill|stroke|object|aspect|decoration|line-clamp|whitespace|break|align|list|appearance|backdrop|blur|divide|float|box|will|touch|snap|scroll)-|^(block|inline|inline-block|inline-flex|flex|grid|hidden|relative|absolute|fixed|sticky|static|contents|truncate|uppercase|lowercase|capitalize|italic|underline|container|visible|invisible|antialiased|sr-only|grow|shrink)$/;

  const TEST_ATTRIBUTES = ['data-testid', 'data-test', 'data-cy', 'data-qa'];

  const segmentFor = (el: Element): { selector: string; anchored: boolean } => {
    for (const attr of TEST_ATTRIBUTES) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      const byAttr = `[${attr}="${CSS.escape(value)}"]`;
      if (isUnique(byAttr)) return { selector: byAttr, anchored: true };
    }
    if (el.id && isStableId(el.id)) {
      const byId = `#${CSS.escape(el.id)}`;
      if (isUnique(byId)) return { selector: byId, anchored: true };
    }

    const tag = el.localName;
    const classes = Array.from(el.classList)
      .filter(isStableClass)
      .sort((a, b) => Number(UTILITY_CLASS.test(a)) - Number(UTILITY_CLASS.test(b)))
      .map((c) => `.${CSS.escape(c)}`);
    const parent = el.parentElement;
    const matchesAmongSiblings = (selector: string) =>
      parent ? Array.from(parent.children).filter((c) => c.matches(selector)).length : 1;

    // The shortest form that tells the element apart from its siblings, most meaningful first.
    const candidates = [tag, ...classes.slice(0, 6).map((c) => tag + c)];
    if (classes.length >= 2) candidates.push(tag + classes[0] + classes[1]);
    const distinct = candidates.find((c) => matchesAmongSiblings(c) === 1);
    if (distinct) return { selector: distinct, anchored: false };

    const sameTag = parent ? Array.from(parent.children).filter((c) => c.localName === tag) : [el];
    return { selector: `${tag}:nth-of-type(${sameTag.indexOf(el) + 1})`, anchored: false };
  };

  const selectorFor = (el: Element) => {
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.documentElement) {
      const { selector, anchored } = segmentFor(node);
      parts.unshift(selector);
      const full = parts.join(' > ');
      if (anchored || isUnique(full)) {
        // Prefer a short "ancestor target" form when it is still unique: it survives layout changes.
        if (parts.length > 2) {
          const short = `${parts[0]} ${parts[parts.length - 1]}`;
          if (isUnique(short)) return short;
        }
        return full;
      }
      node = node.parentElement;
    }
    return parts.join(' > ');
  };

  const suggestType = (el: Element) => {
    const tag = el.localName;
    if (tag === 'h1') return 'headline';
    if (/^h[2-6]$/.test(tag)) return 'subheadline';
    if (
      tag === 'button' ||
      (tag === 'input' && /^(submit|button)$/i.test((el as HTMLInputElement).type)) ||
      (tag === 'a' &&
        (el.getAttribute('role') === 'button' || /btn|button|cta/i.test(el.className)))
    ) {
      return 'cta';
    }
    if (tag === 'li') return 'bullet';
    if (tag === 'p' || tag === 'blockquote') return 'body';
    if (tag === 'label' || tag === 'span' || tag === 'small') return 'label';
    if (tag === 'a') return 'cta';
    return 'other';
  };

  const textOf = (el: Element) => {
    const raw =
      el instanceof HTMLInputElement
        ? el.value
        : ((el as HTMLElement).innerText ?? el.textContent ?? '');
    return raw.replace(/\s+/g, ' ').trim().slice(0, 5000);
  };

  // ---------- Overlay (isolated in a shadow root so page CSS cannot touch it) ----------

  const host = document.createElement('uplift-picker-overlay');
  host.style.cssText =
    'all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      .box { position: fixed; pointer-events: none; box-sizing: border-box; border-radius: 3px; }
      .hover { border: 2px solid #10b981; background: rgba(16, 185, 129, 0.12); transition: all 60ms ease-out; }
      .existing { border: 2px dashed rgba(99, 102, 241, 0.9); background: rgba(99, 102, 241, 0.06); }
      .label { position: fixed; pointer-events: none; font: 600 11px/1.4 system-ui, sans-serif; color: #fff;
        background: #059669; padding: 2px 6px; border-radius: 3px; white-space: nowrap; max-width: 60vw;
        overflow: hidden; text-overflow: ellipsis; }
    </style>
    <div class="box hover" hidden></div>
    <div class="label" hidden></div>
    <div class="existing-layer"></div>`;
  document.documentElement.appendChild(host);
  const hoverBox = shadow.querySelector<HTMLElement>('.hover')!;
  const label = shadow.querySelector<HTMLElement>('.label')!;
  const existingLayer = shadow.querySelector<HTMLElement>('.existing-layer')!;

  const place = (box: HTMLElement, rect: DOMRect) => {
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
  };

  let current: Element | null = null;
  let existingSelectors: string[] = [];

  const renderHover = () => {
    if (!current) {
      hoverBox.hidden = true;
      label.hidden = true;
      return;
    }
    const rect = current.getBoundingClientRect();
    place(hoverBox, rect);
    hoverBox.hidden = false;
    const text = textOf(current);
    label.textContent = `${current.localName}${text ? ` · ${text.length} chars` : ''}`;
    label.style.left = `${Math.max(0, rect.left)}px`;
    label.style.top = `${rect.top > 22 ? rect.top - 22 : rect.bottom + 4}px`;
    label.hidden = false;
  };

  const renderExisting = () => {
    existingLayer.replaceChildren();
    for (const selector of existingSelectors) {
      let el: Element | null = null;
      try {
        el = document.querySelector(selector);
      } catch {
        continue;
      }
      if (!el) continue;
      const box = document.createElement('div');
      box.className = 'box existing';
      place(box, el.getBoundingClientRect());
      existingLayer.appendChild(box);
    }
  };

  const render = () => {
    renderHover();
    renderExisting();
  };

  // ---------- Events ----------

  document.addEventListener(
    'mouseover',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element) || target === host) return;
      current = target;
      renderHover();
    },
    true,
  );
  document.addEventListener('mouseleave', () => {
    current = null;
    renderHover();
  });

  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };
  for (const type of ['mousedown', 'mouseup', 'submit', 'auxclick', 'dblclick']) {
    document.addEventListener(type, swallow, true);
  }
  document.addEventListener(
    'click',
    (event) => {
      swallow(event);
      const target = event.target;
      if (!(target instanceof Element) || target === host) return;
      post({
        type: 'pick',
        element: {
          selector: selectorFor(target),
          text: textOf(target),
          tagName: target.localName,
          suggestedType: suggestType(target),
        },
      });
    },
    true,
  );
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') post({ type: 'cancel' });
  });

  window.addEventListener('scroll', render, { passive: true, capture: true });
  window.addEventListener('resize', render);

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const data = event.data as { source?: string; type?: string; selectors?: unknown };
    if (data?.source !== 'uplift-app' || data.type !== 'highlight') return;
    existingSelectors = Array.isArray(data.selectors)
      ? data.selectors.filter((s): s is string => typeof s === 'string')
      : [];
    renderExisting();
  });

  post({ type: 'ready' });
}
