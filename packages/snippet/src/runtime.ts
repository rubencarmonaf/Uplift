import type { RuntimeConfig } from '@uplift/shared';
import { matchesPageview } from '@uplift/shared/url-match';
import { hostnameAllowed, inScope, isInExperiment, pickArm, randomId } from './assign';
import { applyText, queryOne } from './dom';

/**
 * The production script (uplift.js). Served with its config appended as
 * `window.__upliftBoot(config)`, so one request is enough and several experiments can coexist.
 *
 * For each visitor: decide once whether they take part and which arm they see (stable across
 * visits), apply that arm's copy, report the exposure, then report conversions for the goals.
 * `?uplift_arm=<armId>` forces an arm for QA; forced visits are never tracked.
 */

type Change = { selector: string; text: string };

const APPLY_WINDOW_MS = 5000;

/** The page URL used for scope and goals (the original site's URL on the test page). */
let targetUrl = () => location.href;
const pageHostname = () => new URL(targetUrl()).hostname;

/** localStorage when available; in-memory otherwise (private modes, sandboxed frames). */
const memory = new Map<string, string>();
const storage = {
  get(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
};

function visitorId() {
  let id = storage.get('uplift_vid');
  if (!id) {
    id = randomId();
    storage.set('uplift_vid', id);
  }
  return id;
}

function reveal() {
  document.documentElement.classList.remove('uplift-hide');
}

/** Debug hook: the test page listens to these to show what the script is doing. */
function emit(detail: Record<string, unknown>) {
  try {
    window.dispatchEvent(new CustomEvent('uplift:debug', { detail }));
  } catch {
    // CustomEvent unsupported: debugging only, nothing to do.
  }
}

/**
 * Applies the copy, waiting for elements rendered later (SPAs) for a few seconds.
 * Calls `done` once everything is applied or the wait is over.
 */
function applyChanges(changes: Change[], done: () => void) {
  const pending = new Set(changes);
  const tryApply = () => {
    for (const change of pending) {
      const el = queryOne(document, change.selector);
      if (el) {
        applyText(el, change.text);
        pending.delete(change);
      }
    }
    return pending.size === 0;
  };
  if (tryApply()) return done();

  const observer = new MutationObserver(() => {
    if (tryApply()) finish();
  });
  const timer = setTimeout(() => finish(), APPLY_WINDOW_MS);
  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    observer.disconnect();
    clearTimeout(timer);
    done();
  }
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function send(endpoint: string, body: Record<string, unknown>) {
  const payload = JSON.stringify(body);
  emit({ type: 'sent', body });
  // text/plain keeps it a "simple" request: no CORS preflight, and sendBeacon survives navigation.
  const blob = new Blob([payload], { type: 'text/plain' });
  if (navigator.sendBeacon && navigator.sendBeacon(endpoint, blob)) return;
  void fetch(endpoint, { method: 'POST', body: payload, keepalive: true, mode: 'cors' }).catch(
    () => {},
  );
}

function trackGoals(config: RuntimeConfig, track: (goalId: string) => void) {
  const checkPageviews = () => {
    for (const goal of config.goals) {
      if (goal.kind === 'pageview' && matchesPageview(goal, targetUrl())) track(goal.id);
    }
  };

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      for (const goal of config.goals) {
        if (goal.kind !== 'click') continue;
        try {
          if (target.closest(goal.selector)) track(goal.id);
        } catch {
          // Invalid selector: ignore this goal.
        }
      }
    },
    true,
  );

  // Single-page apps change the URL without reloading.
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method];
    history[method] = function (this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      setTimeout(checkPageviews, 0);
      return result;
    };
  }
  window.addEventListener('popstate', checkPageviews);
  checkPageviews();

  const onEvent = (name: unknown) => {
    for (const goal of config.goals) {
      if (goal.kind === 'event' && goal.eventName === name) track(goal.id);
    }
  };
  const w = window as unknown as { dataLayer?: unknown[]; uplift?: Record<string, unknown> };
  const dataLayer = (w.dataLayer = w.dataLayer || []);
  const push = dataLayer.push.bind(dataLayer);
  dataLayer.push = (...items: unknown[]) => {
    for (const item of items) {
      if (item && typeof item === 'object' && 'event' in item)
        onEvent((item as { event: unknown }).event);
    }
    return push(...items);
  };
  w.uplift = { ...w.uplift, track: onEvent };
}

function boot(config: RuntimeConfig) {
  try {
    run(config);
  } catch (err) {
    // Never break the host page: show it as it is.
    reveal();
    emit({ type: 'error', message: String(err) });
  }
}

function run(config: RuntimeConfig) {
  if (config.targetUrl) {
    const fixed = config.targetUrl;
    targetUrl = () => fixed;
  }
  if (!hostnameAllowed(pageHostname(), config.scope.domains)) {
    emit({ type: 'skipped', reason: 'domain' });
    return reveal();
  }

  // A finished experiment with a winner: everyone gets the winner, nothing is tracked.
  if (config.winner) {
    emit({ type: 'winner', armId: config.winner.armId });
    return applyChanges(inScope(targetUrl(), config.scope) ? config.winner.changes : [], reveal);
  }

  const forced = new URLSearchParams(location.search).get('uplift_arm');
  const vid = visitorId();
  const assignmentKey = `uplift_arm_${config.experimentId}`;
  let armId = forced ?? storage.get(assignmentKey);

  if (!forced && !armId && config.status === 'running' && inScope(targetUrl(), config.scope)) {
    armId = isInExperiment(vid, config.experimentId, config.trafficPercent)
      ? (pickArm(config.arms, vid, config.experimentId)?.id ?? 'out')
      : 'out';
    storage.set(assignmentKey, armId);
  }

  const arm = config.arms.find((a) => a.id === armId);
  emit({
    type: 'assigned',
    armId: arm?.id ?? null,
    forced: !!forced,
    visitorId: vid,
    status: config.status,
  });
  (window as unknown as { uplift?: Record<string, unknown> }).uplift = {
    ...(window as unknown as { uplift?: Record<string, unknown> }).uplift,
    variant: () => arm?.id ?? null,
  };

  // Paused experiments keep showing assigned visitors their arm but record nothing new.
  const tracking = !!arm && !forced && config.status === 'running';
  const scoped = inScope(targetUrl(), config.scope);
  applyChanges(arm && scoped ? arm.changes : [], reveal);
  if (!tracking || !arm) return;

  const once = (key: string, body: Record<string, unknown>) => {
    const flag = `uplift_sent_${config.experimentId}_${key}`;
    if (storage.get(flag)) return;
    storage.set(flag, '1');
    send(config.endpoint, { visitorId: vid, armId: arm.id, ...body });
  };
  if (scoped) once('exposure', { type: 'exposure' });
  // Conversions only count for visitors who saw the experiment.
  if (storage.get(`uplift_sent_${config.experimentId}_exposure`)) {
    trackGoals(config, (goalId) => once(`goal_${goalId}`, { type: 'conversion', goalId }));
  }
}

(window as unknown as { __upliftBoot?: typeof boot }).__upliftBoot = boot;
