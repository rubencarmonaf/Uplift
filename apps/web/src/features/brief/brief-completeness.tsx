import { type Brief, BRIEF_CHECKS } from '@uplift/shared';
import { Check, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/** Where each check's field lives, to jump to it from the checklist. */
const CHECK_TARGETS: Record<(typeof BRIEF_CHECKS)[number]['id'], string> = {
  product: 'offer.product',
  audience: 'reader.audience',
  pageGoal: 'offer.pageGoal',
  tone: 'brief-style',
  formality: 'brief-style',
  benefits: 'offer.benefits',
  proofPoints: 'evidence.proofPoints',
  sensitivity: 'brief-rules',
};

export function BriefCompleteness({ brief }: { brief: Brief }) {
  const { t } = useTranslation();
  const results = BRIEF_CHECKS.map((check) => ({ id: check.id, done: check.done(brief) }));
  const done = results.filter((r) => r.done).length;
  const percent = Math.round((done / results.length) * 100);

  const focus = (targetId: string) => {
    const target = document.getElementById(targetId);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      target.focus({ preventScroll: true });
    }
  };

  return (
    <section className="grid gap-3 rounded-xl border p-4" aria-labelledby="brief-completeness">
      <div className="flex items-baseline justify-between">
        <h2 id="brief-completeness" className="text-sm font-medium">
          {t('brief.completeness.title')}
        </h2>
        <span className="text-sm text-muted-foreground tabular-nums">{percent}%</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-labelledby="brief-completeness"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('brief.completeness.description')}</p>
      <ul className="grid gap-1 text-sm">
        {results.map(({ id, done: isDone }) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => focus(CHECK_TARGETS[id])}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted',
                isDone ? 'text-muted-foreground' : 'text-foreground',
              )}
            >
              {isDone ? (
                <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
              )}
              <span className={cn(isDone && 'line-through decoration-muted-foreground/40')}>
                {t(`brief.completeness.checks.${id}`)}
              </span>
              <span className="sr-only">
                {isDone ? t('brief.completeness.done') : t('brief.completeness.pending')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
