import type { GenerationRun, PageElement, Variant } from '@uplift/shared';
import { BRIEF_CHECKS, MAX_VARIANTS_PER_REQUEST } from '@uplift/shared';
import { AlertTriangle, FlaskConical, Info, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useBrief } from '@/features/brief/api';
import { useElements } from '@/features/elements/api';
import { useCurrentOrg } from '@/features/organizations/use-current-org';
import { useProjectContext } from '@/features/projects/project-steps';
import { ApiError } from '@/lib/api';
import {
  useAiStatus,
  useCreateVariant,
  useGenerateVariants,
  useLatestGeneration,
  useVariants,
} from './api';
import { VariantCard } from './variant-card';

const isRunning = (run: GenerationRun | null | undefined) =>
  run?.status === 'queued' || run?.status === 'running';

export function VariantsPage() {
  const { t, i18n } = useTranslation();
  const { project } = useProjectContext();
  const org = useCurrentOrg();
  const elements = useElements(project.id);
  const brief = useBrief(project.id);
  const aiStatus = useAiStatus();
  const run = useLatestGeneration(project.id);
  const variants = useVariants(project.id, run.data);
  const generate = useGenerateVariants(project.id);
  const [count, setCount] = useState(3);
  const [instructions, setInstructions] = useState('');

  const running = isRunning(run.data) || generate.isPending;
  const language = i18n.resolvedLanguage === 'es' ? 'es' : 'en';

  const startGeneration = (elementIds?: string[]) =>
    generate.mutate(
      { elementIds, count, instructions, language },
      {
        onError: (err) =>
          toast.error(
            err instanceof ApiError && err.status === 409
              ? t('variants.errors.alreadyRunning')
              : err instanceof ApiError && err.status === 429
                ? t('variants.errors.rateLimited')
                : t('common.errors.generic'),
          ),
      },
    );

  if (elements.isPending || variants.isPending) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (elements.isError || variants.isError) return <p>{t('common.errors.loadFailed')}</p>;

  if (elements.data.length === 0) {
    return (
      <section className="grid place-items-center rounded-xl border border-dashed px-6 py-14 text-center">
        <div className="grid max-w-sm justify-items-center gap-3">
          <Sparkles className="size-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-medium">{t('variants.noElements.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('variants.noElements.description')}</p>
          <Button asChild variant="outline">
            <Link to="../elements" relative="path">
              {t('variants.noElements.cta')}
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  const briefDone = brief.data
    ? BRIEF_CHECKS.filter((c) => c.done(brief.data.brief)).length / BRIEF_CHECKS.length
    : 1;
  const byElement = new Map<string, Variant[]>();
  for (const v of variants.data)
    byElement.set(v.elementId, [...(byElement.get(v.elementId) ?? []), v]);

  return (
    <div className="grid gap-6">
      {aiStatus.data?.provider === 'mock' && (
        <Alert>
          <FlaskConical aria-hidden="true" />
          <AlertTitle>{t('variants.demo.title')}</AlertTitle>
          <AlertDescription>{t('variants.demo.description')}</AlertDescription>
        </Alert>
      )}
      {briefDone < 0.5 && (
        <Alert>
          <Info aria-hidden="true" />
          <AlertTitle>{t('variants.weakBrief.title')}</AlertTitle>
          <AlertDescription className="grid justify-items-start gap-2">
            {t('variants.weakBrief.description')}
            <Button asChild size="sm" variant="outline">
              <Link to="../brief" relative="path">
                {t('variants.weakBrief.cta')}
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {org.canEdit && (
        <section
          className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-end"
          aria-labelledby="generate-heading"
        >
          <h2 id="generate-heading" className="sr-only">
            {t('variants.generate')}
          </h2>
          <div className="grid gap-2">
            <Label htmlFor="variant-count">{t('variants.count')}</Label>
            <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
              <SelectTrigger id="variant-count" className="w-full md:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: MAX_VARIANTS_PER_REQUEST }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {t('variants.perElement', { count: n })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="variant-instructions">{t('variants.instructions')}</Label>
            <Input
              id="variant-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={500}
              placeholder={t('variants.instructionsPlaceholder')}
            />
          </div>
          <Button onClick={() => startGeneration()} disabled={running}>
            <Sparkles />
            {t('variants.generateAll', { count: elements.data.length })}
          </Button>
        </section>
      )}

      {run.data && <RunStatus run={run.data} />}

      <div className="grid gap-8">
        {elements.data.map((element) => (
          <ElementVariants
            key={element.id}
            element={element}
            variants={byElement.get(element.id) ?? []}
            canEdit={org.canEdit}
            running={running}
            onGenerate={() => startGeneration([element.id])}
          />
        ))}
      </div>
    </div>
  );
}

function RunStatus({ run }: { run: GenerationRun }) {
  const { t } = useTranslation();
  if (isRunning(run)) {
    const done = run.completedElements + run.failedElements;
    const percent = Math.round((done / run.totalElements) * 100);
    return (
      <div className="grid gap-2 rounded-xl border p-4" role="status" aria-live="polite">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Sparkles className="size-4 animate-pulse text-primary" aria-hidden="true" />
            {t('variants.progress', { done, total: run.totalElements })}
          </span>
          <span className="text-muted-foreground tabular-nums">{percent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${Math.max(percent, 4)}%` }}
          />
        </div>
      </div>
    );
  }
  if (run.failedElements > 0) {
    return (
      <Alert variant="destructive">
        <AlertTriangle aria-hidden="true" />
        <AlertTitle>
          {t(run.status === 'failed' ? 'variants.failed.all' : 'variants.failed.some', {
            count: run.failedElements,
          })}
        </AlertTitle>
        <AlertDescription>{t('variants.failed.description')}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

function ElementVariants({
  element,
  variants,
  canEdit,
  running,
  onGenerate,
}: {
  element: PageElement;
  variants: Variant[];
  canEdit: boolean;
  running: boolean;
  onGenerate: () => void;
}) {
  const { t } = useTranslation();
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [manual, setManual] = useState('');
  const create = useCreateVariant(element.projectId);
  const active = variants.filter((v) => v.status === 'active');
  const discarded = variants.filter((v) => v.status === 'discarded');
  const shown = showDiscarded ? [...active, ...discarded] : active;

  const addManual = () => {
    const text = manual.trim();
    if (!text) return;
    create.mutate(
      { elementId: element.id, text },
      {
        onSuccess: () => {
          setManual('');
          toast.success(t('variants.toasts.added'));
        },
        onError: () => toast.error(t('common.errors.generic')),
      },
    );
  };

  return (
    <section className="grid gap-3" aria-labelledby={`variants-${element.id}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`variants-${element.id}`} className="text-lg font-medium">
              {element.name}
            </h2>
            <Badge variant="secondary">{t(`elements.types.${element.type}`)}</Badge>
            <span className="text-sm text-muted-foreground">
              {t('variants.activeCount', { count: active.length })}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{t('variants.control')}:</span>{' '}
            {element.originalText}
          </p>
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={onGenerate} disabled={running}>
            <Sparkles />
            {t('variants.generateMore')}
          </Button>
        )}
      </header>

      {shown.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((variant) => (
            <VariantCard
              key={variant.id}
              variant={variant}
              projectId={element.projectId}
              maxLength={element.maxLength}
              canEdit={canEdit}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {t('variants.empty')}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <form
            className="flex min-w-64 flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addManual();
            }}
          >
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder={t('variants.manualPlaceholder')}
              aria-label={t('variants.manualLabel', { name: element.name })}
              maxLength={5000}
            />
            <Button type="submit" variant="ghost" disabled={!manual.trim() || create.isPending}>
              <Plus />
              {t('variants.add')}
            </Button>
          </form>
        )}
        {discarded.length > 0 && (
          <Button variant="link" size="sm" onClick={() => setShowDiscarded((v) => !v)}>
            {t(showDiscarded ? 'variants.hideDiscarded' : 'variants.showDiscarded', {
              count: discarded.length,
            })}
          </Button>
        )}
      </div>
    </section>
  );
}
