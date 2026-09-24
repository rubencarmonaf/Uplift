import type { Variant } from '@uplift/shared';
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Pencil,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useUpdateVariant } from './api';

export function VariantCard({
  variant,
  projectId,
  maxLength,
  canEdit,
}: {
  variant: Variant;
  projectId: string;
  maxLength: number | null;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const update = useUpdateVariant(projectId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(variant.text);
  const discarded = variant.status === 'discarded';
  const compliant = variant.issues.length === 0;
  const onError = () => toast.error(t('common.errors.generic'));

  const save = () => {
    const text = draft.trim();
    if (!text || text === variant.text) {
      setEditing(false);
      return;
    }
    update.mutate({ id: variant.id, text }, { onSuccess: () => setEditing(false), onError });
  };

  return (
    <li
      className={cn(
        'grid gap-3 rounded-xl border bg-card p-4 transition-opacity',
        discarded && 'opacity-60',
      )}
    >
      {editing ? (
        <div className="grid gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            autoFocus
            aria-label={t('variants.editLabel')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                save();
              } else if (e.key === 'Escape') {
                setDraft(variant.text);
                setEditing(false);
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'text-xs text-muted-foreground tabular-nums',
                maxLength != null &&
                  draft.length > maxLength &&
                  'text-amber-600 dark:text-amber-400',
              )}
            >
              {t('elements.charCount', { count: draft.length })}
              {maxLength != null && ` / ${maxLength}`}
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(variant.text);
                  setEditing(false);
                }}
              >
                <X />
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={save} disabled={update.isPending}>
                <Check />
                {t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className={cn('text-base font-medium break-words', discarded && 'line-through')}>
          {variant.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {variant.angle && (
          <Badge variant="secondary">{t(`variants.angles.${variant.angle}`)}</Badge>
        )}
        {variant.source === 'manual' && <Badge variant="outline">{t('variants.manual')}</Badge>}
        <Badge
          variant="outline"
          className={cn(
            'gap-1',
            compliant
              ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/50 text-amber-700 dark:text-amber-300',
          )}
          title={t('variants.complianceHint')}
        >
          {compliant ? <ShieldCheck className="size-3" /> : <ShieldAlert className="size-3" />}
          {t('variants.compliance', { score: variant.complianceScore })}
        </Badge>
        {variant.qualityScore != null && (
          <span
            className="inline-flex items-center gap-1.5 text-muted-foreground"
            title={t('variants.qualityHint')}
          >
            {t('variants.quality')}
            <span
              className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={variant.qualityScore}
              aria-label={t('variants.quality')}
            >
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${variant.qualityScore}%` }}
              />
            </span>
            <span className="tabular-nums">{variant.qualityScore}</span>
          </span>
        )}
        <span className="text-muted-foreground tabular-nums">
          {t('elements.charCount', { count: variant.text.length })}
        </span>
      </div>

      {variant.issues.length > 0 && (
        <ul className="grid gap-1 text-sm text-amber-700 dark:text-amber-300">
          {variant.issues.map((issue, i) => (
            <li key={i} className="flex gap-1.5">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {t(`variants.issues.${issue.rule}`, { detail: issue.detail })}
            </li>
          ))}
        </ul>
      )}

      {variant.rationale && <p className="text-sm text-muted-foreground">{variant.rationale}</p>}

      {canEdit && !editing && (
        <div className="flex gap-1">
          {!discarded && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil />
              {t('variants.edit')}
            </Button>
          )}
          {!discarded && (
            <Button
              size="sm"
              variant="ghost"
              aria-pressed={variant.saved}
              onClick={() =>
                update.mutate(
                  { id: variant.id, saved: !variant.saved },
                  {
                    onSuccess: () =>
                      toast.success(
                        t(variant.saved ? 'library.toasts.removed' : 'library.toasts.saved'),
                      ),
                    onError,
                  },
                )
              }
            >
              {variant.saved ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
              {t(variant.saved ? 'library.inLibrary' : 'library.save')}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              update.mutate(
                { id: variant.id, status: discarded ? 'active' : 'discarded' },
                { onError },
              )
            }
          >
            {discarded ? <RotateCcw /> : <Trash2 />}
            {t(discarded ? 'variants.restore' : 'variants.discard')}
          </Button>
        </div>
      )}
    </li>
  );
}
