import {
  type Arm,
  type Experiment,
  type ExperimentScope,
  URL_MATCH_TYPES,
  type Variant,
} from '@uplift/shared';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { TagInput } from '@/components/tag-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { useElements } from '@/features/elements/api';
import { useGoals } from '@/features/goals/api';
import { useCurrentOrg } from '@/features/organizations/use-current-org';
import { useProjectContext } from '@/features/projects/project-steps';
import { useLatestGeneration, useVariants } from '@/features/variants/api';
import { ApiError } from '@/lib/api';
import { useExperiment, useUpdateExperiment } from './api';
import { ArmsBuilder } from './arms-builder';
import { InstallCard } from './install-card';
import { StatusCard } from './status-card';

type Draft = {
  arms: Arm[];
  trafficPercent: number;
  antiFlicker: Experiment['antiFlicker'];
  scope: ExperimentScope;
};

const toDraft = (e: Experiment): Draft => ({
  arms: e.arms,
  trafficPercent: e.trafficPercent,
  antiFlicker: e.antiFlicker,
  scope: e.scope,
});

const ALL_PAGES = 'all';

export function ActivationPage() {
  const { t } = useTranslation();
  const { project } = useProjectContext();
  const experiment = useExperiment(project.id);
  const elements = useElements(project.id);
  const goals = useGoals(project.id);
  const job = useLatestGeneration(project.id);
  const variants = useVariants(project.id, job.data);

  if (experiment.isPending || elements.isPending || goals.isPending || variants.isPending) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (experiment.isError || elements.isError || goals.isError || variants.isError) {
    return <p>{t('common.errors.loadFailed')}</p>;
  }
  return (
    <ActivationForm
      key={experiment.data.updatedAt}
      experiment={experiment.data}
      elements={elements.data}
      goals={goals.data}
      variants={variants.data}
    />
  );
}

function ActivationForm({
  experiment,
  elements,
  goals,
  variants,
}: {
  experiment: Experiment;
  elements: NonNullable<ReturnType<typeof useElements>['data']>;
  goals: NonNullable<ReturnType<typeof useGoals>['data']>;
  variants: Variant[];
}) {
  const { t } = useTranslation();
  const org = useCurrentOrg();
  const update = useUpdateExperiment(experiment.projectId);
  const [draft, setDraft] = useState(() => toDraft(experiment));
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(experiment));
  const armsLocked = experiment.status !== 'draft' || !org.canEdit;

  const variantsByElement = useMemo(() => {
    const map = new Map<string, Variant[]>();
    for (const v of variants) {
      if (v.status === 'active') map.set(v.elementId, [...(map.get(v.elementId) ?? []), v]);
    }
    return map;
  }, [variants]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = () =>
    update.mutate(experiment.status === 'draft' ? draft : { ...draft, arms: undefined }, {
      onSuccess: () => toast.success(t('activation.toasts.saved')),
      onError: (err) =>
        toast.error(
          err instanceof ApiError && err.status === 400
            ? t('activation.errors.invalid')
            : t('common.errors.generic'),
        ),
    });

  return (
    <div className="grid gap-6">
      <StatusCard
        experiment={experiment}
        goals={goals}
        canEdit={org.canEdit}
        hasUnsavedChanges={dirty}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('activation.arms.title')}</CardTitle>
          <CardDescription>
            {t(
              armsLocked && org.canEdit ? 'activation.arms.locked' : 'activation.arms.description',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {elements.length === 0 ? (
            <Alert>
              <AlertDescription>{t('preview.noElements')}</AlertDescription>
            </Alert>
          ) : (
            <ArmsBuilder
              arms={draft.arms}
              onChange={(arms) => set('arms', arms)}
              elements={elements}
              variantsByElement={variantsByElement}
              disabled={armsLocked}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('activation.settings.title')}</CardTitle>
            <CardDescription>{t('activation.settings.description')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="traffic">{t('activation.settings.traffic')}</Label>
              <div className="flex items-center gap-3">
                <input
                  id="traffic"
                  type="range"
                  min={1}
                  max={100}
                  value={draft.trafficPercent}
                  onChange={(e) => set('trafficPercent', Number(e.target.value))}
                  disabled={!org.canEdit}
                  className="flex-1 accent-(--primary)"
                />
                <span className="w-12 text-right text-sm tabular-nums">
                  {draft.trafficPercent}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('activation.settings.trafficHint')}
              </p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="anti-flicker">{t('activation.settings.antiFlicker')}</Label>
                <Switch
                  id="anti-flicker"
                  checked={draft.antiFlicker.enabled}
                  onCheckedChange={(enabled) =>
                    set('antiFlicker', { ...draft.antiFlicker, enabled })
                  }
                  disabled={!org.canEdit}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('activation.settings.antiFlickerHint')}
              </p>
              {draft.antiFlicker.enabled && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="af-timeout" className="text-xs font-normal">
                    {t('activation.settings.timeout')}
                  </Label>
                  <Input
                    id="af-timeout"
                    type="number"
                    min={100}
                    max={4000}
                    step={100}
                    value={draft.antiFlicker.timeoutMs}
                    onChange={(e) =>
                      set('antiFlicker', {
                        ...draft.antiFlicker,
                        timeoutMs: Math.max(100, Math.min(4000, Number(e.target.value) || 100)),
                      })
                    }
                    disabled={!org.canEdit}
                    className="h-8 w-24"
                  />
                  <span className="text-xs text-muted-foreground">ms</span>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="domains">{t('activation.settings.domains')}</Label>
              <TagInput
                id="domains"
                value={draft.scope.domains}
                onChange={(domains) => set('scope', { ...draft.scope, domains })}
                splitOnComma
                maxItems={20}
                maxLength={253}
                placeholder="www.example.com, *.example.com"
                disabled={!org.canEdit}
              />
              <p className="text-xs text-muted-foreground">
                {t('activation.settings.domainsHint')}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="path-match">{t('activation.settings.pages')}</Label>
              <div className="flex gap-2">
                <Select
                  value={draft.scope.path?.match ?? ALL_PAGES}
                  onValueChange={(match) =>
                    set('scope', {
                      ...draft.scope,
                      path:
                        match === ALL_PAGES
                          ? null
                          : {
                              match: match as (typeof URL_MATCH_TYPES)[number],
                              value: draft.scope.path?.value ?? '/',
                            },
                    })
                  }
                  disabled={!org.canEdit}
                >
                  <SelectTrigger id="path-match" className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_PAGES}>{t('activation.settings.allPages')}</SelectItem>
                    {URL_MATCH_TYPES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {t(`goals.matches.${m}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {draft.scope.path && (
                  <Input
                    value={draft.scope.path.value}
                    onChange={(e) =>
                      set('scope', {
                        ...draft.scope,
                        path: { ...draft.scope.path!, value: e.target.value },
                      })
                    }
                    className="font-mono text-sm"
                    aria-label={t('goals.fields.value')}
                    disabled={!org.canEdit}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <InstallCard experiment={experiment} />
      </div>

      {org.canEdit && dirty && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
          <span className="mr-auto text-sm text-muted-foreground">{t('brief.unsaved')}</span>
          <Button variant="ghost" onClick={() => setDraft(toDraft(experiment))}>
            {t('brief.discard')}
          </Button>
          <Button onClick={save} disabled={update.isPending || draft.scope.domains.length === 0}>
            {t('common.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
