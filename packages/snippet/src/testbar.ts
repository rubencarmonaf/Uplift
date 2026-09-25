/**
 * Toolbar for the experiment test page (a copy of the customer's page with the real script).
 * Shows what the script decided and sent, lets you force an arm, and keeps clicks on the page
 * so goals can be triggered without navigating away. Loaded before the script so it hears
 * every `uplift:debug` event.
 */
type ArmInfo = { id: string; name: string };
type Labels = Record<
  | 'title'
  | 'assigned'
  | 'outside'
  | 'original'
  | 'forced'
  | 'notRunning'
  | 'visitor'
  | 'events'
  | 'noEvents'
  | 'exposure'
  | 'conversion'
  | 'newVisitor'
  | 'force'
  | 'clickKept'
  | 'forcedHint',
  string
>;

const script = document.currentScript as HTMLScriptElement;
const arms = JSON.parse(script.dataset.arms ?? '[]') as ArmInfo[];
const goals = JSON.parse(script.dataset.goals ?? '{}') as Record<string, string>;
const labels = JSON.parse(script.dataset.labels ?? '{}') as Labels;

const host = document.createElement('uplift-testbar');
host.style.cssText =
  'all: initial; position: fixed; left: 16px; bottom: 16px; z-index: 2147483647;';
const root = host.attachShadow({ mode: 'closed' });
root.innerHTML = `
  <style>
    .panel { font: 13px/1.4 system-ui, sans-serif; color: #0b1411; background: #fff; width: 300px;
      border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.25); border: 1px solid #d6e5de; overflow: hidden; }
    header { background: #0f8a5f; color: #fff; padding: 8px 12px; font-weight: 600; display: flex; justify-content: space-between; }
    .body { padding: 10px 12px; display: grid; gap: 8px; }
    .muted { color: #5b6b64; font-size: 12px; }
    .arm { font-weight: 600; }
    ul { margin: 0; padding: 0; list-style: none; max-height: 120px; overflow: auto; display: grid; gap: 2px; }
    li { font-size: 12px; }
    .buttons { display: flex; flex-wrap: wrap; gap: 4px; }
    button { font: inherit; font-size: 12px; border: 1px solid #b9cfc5; background: #f4faf7; border-radius: 6px; padding: 3px 8px; cursor: pointer; }
    button.active { background: #0f8a5f; color: #fff; border-color: #0f8a5f; }
    .toast { position: absolute; left: 0; bottom: calc(100% + 8px); background: #0b1411; color: #fff; padding: 6px 10px; border-radius: 8px; font: 12px system-ui; opacity: 0; transition: opacity .2s; white-space: nowrap; }
    .toast.show { opacity: 1; }
    .collapse { background: none; border: 0; color: #fff; padding: 0; }
  </style>
  <div class="toast" role="status"></div>
  <section class="panel" aria-label="${labels.title}">
    <header><span>${labels.title}</span><button class="collapse" aria-expanded="true">–</button></header>
    <div class="body">
      <div><span class="muted">${labels.assigned}</span> <span class="arm">…</span></div>
      <div class="muted visitor"></div>
      <div class="muted">${labels.events}</div>
      <ul><li class="muted empty">${labels.noEvents}</li></ul>
      <div class="buttons"></div>
      <div class="muted hint"></div>
    </div>
  </section>`;
document.documentElement.appendChild(host);

const $ = <T extends Element>(sel: string) => root.querySelector(sel) as T;
const armLabel = $<HTMLSpanElement>('.arm');
const list = $<HTMLUListElement>('ul');
const toast = $<HTMLDivElement>('.toast');
const forcedId = new URLSearchParams(location.search).get('uplift_arm');
const nameOf = (id: string | null) => arms.find((a) => a.id === id)?.name ?? labels.original;

const reload = (armId: string | null) => {
  const url = new URL(location.href);
  if (armId) url.searchParams.set('uplift_arm', armId);
  else url.searchParams.delete('uplift_arm');
  location.href = url.toString();
};

const buttons = $<HTMLDivElement>('.buttons');
const fresh = document.createElement('button');
fresh.textContent = labels.newVisitor;
fresh.className = forcedId ? '' : 'active';
fresh.addEventListener('click', () => reload(null));
buttons.appendChild(fresh);
for (const arm of arms) {
  const b = document.createElement('button');
  b.textContent = `${labels.force} ${arm.name}`;
  if (arm.id === forcedId) b.className = 'active';
  b.addEventListener('click', () => reload(arm.id));
  buttons.appendChild(b);
}
if (forcedId) $<HTMLDivElement>('.hint').textContent = labels.forcedHint;

const collapse = $<HTMLButtonElement>('.collapse');
collapse.addEventListener('click', () => {
  const body = $<HTMLDivElement>('.body');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'grid';
  collapse.textContent = open ? '+' : '–';
  collapse.setAttribute('aria-expanded', String(!open));
});

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function flash(text: string) {
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

window.addEventListener('uplift:debug', (event) => {
  const detail = (event as CustomEvent).detail as Record<string, unknown>;
  if (detail.type === 'assigned') {
    const id = detail.armId as string | null;
    armLabel.textContent =
      detail.status !== 'running' && !detail.forced
        ? labels.notRunning
        : id
          ? `${nameOf(id)}${detail.forced ? ` (${labels.forced})` : ''}`
          : labels.outside;
    $<HTMLDivElement>('.visitor').textContent =
      `${labels.visitor}: ${String(detail.visitorId).slice(0, 8)}…`;
  } else if (detail.type === 'sent') {
    const body = detail.body as { type: string; goalId?: string };
    list.querySelector('.empty')?.remove();
    const item = document.createElement('li');
    item.textContent =
      body.type === 'exposure'
        ? `• ${labels.exposure}`
        : `• ${labels.conversion}: ${goals[body.goalId ?? ''] ?? body.goalId}`;
    list.appendChild(item);
    if (body.type === 'conversion')
      flash(`${labels.conversion}: ${goals[body.goalId ?? ''] ?? ''}`);
  }
});

// Keep the visitor on this page: the script sees the click first (capture), then we cancel it.
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || host.contains(target)) return;
  if (target.closest('a, button, [role="button"], input[type="submit"]')) {
    event.preventDefault();
    flash(labels.clickKept);
  }
});
document.addEventListener('submit', (event) => event.preventDefault());
