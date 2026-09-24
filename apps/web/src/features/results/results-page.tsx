import type { ArmResult, ExperimentResults } from '@uplift/shared';
import {
  CheckCircle2,
  Clock,
  FlaskConical,
  Hourglass,
  Loader2,
  Minus,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useExperimentAction } from '@/features/activation/api';
import { useCurrentOrg } from '@/features/organizations/use-current-org';
import { useProjectContext } from '@/features/projects/project-steps';
import { cn } from '@/lib/utils';
import { useClearSimulation, useResults, useSimulateTraffic } from './api';
import { ConversionChart } from './conversion-chart';
import { integer, percent, probability, seriesColor, signedPercent } from './format';

export function ResultsPage() {
  const { t } = useTranslation();
  const { project } = useProjectContext();
  const { data: results, isPending, isError } = useResults(project.id);

  if (isPending) return <Skeleton className="h-96 w-full" />;
  if (isError) return <p>{t('common.errors.loadFailed')}</p>;
  if (!results || results.status === 'draft') {
    return (
      <section className="grid place-items-center rounded-xl border border-dashed px-6 py-14 text-center">
        <div className="grid max-w-sm justify-items-center gap-3">
          <Hourglass className="size-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-medium">{t('results.notStarted.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('results.notStarted.description')}</p>
          <Button asChild variant="outline">
            <Link to="../activation" relative="path">
              {t('results.notStarted.cta')}
            </Link>
          </Button>
        </div>
      </section>
    );
  }
  return <Results results={results} />;
}

function Results({ results }: { results: ExperimentResults }) {
  const { t, i18n } = useTranslation();
  const { project } = useProjectContext();
  const org = useCurrentOrg();
  const locale = i18n.resolvedLanguage ?? 'en';

  return (
    <div className="grid gap-6">
      <VerdictBanner results={results} canEdit={org.canEdit} />

      <Card>
        <CardHeader>
          <CardTitle>{t('results.table.title')}</CardTitle>
          <CardDescription>
            {results.primaryGoal
              ? t('results.table.description', { goal: results.primaryGoal.name })
              : t('results.table.noGoal')}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <ArmsTable arms={results.arms} locale={locale} />
          <ConversionChart results={results} />
        </CardContent>
      </Card>

      {results.secondary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('results.secondary.title')}</CardTitle>
            <CardDescription>{t('results.secondary.description')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {results.secondary.map((goal) => (
              <div key={goal.goalId} className="grid gap-2">
                <h3 className="text-sm font-medium">{goal.name}</h3>
                <ArmsTable arms={goal.arms} locale={locale} compact />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {org.canEdit && <SimulationCard projectId={project.id} results={results} />}
    </div>
  );
}

function VerdictBanner({ results, canEdit }: { results: ExperimentResults; canEdit: boolean }) {
  const { t, i18n } = useTranslation();
  const { project } = useProjectContext();
  const act = useExperimentAction(project.id);
  const locale = i18n.resolvedLanguage ?? 'en';
  const { verdict } = results;
  const winnerArm =
    verdict.status === 'winner' ? results.arms.find((a) => a.armId === verdict.armId) : null;
  const live = results.status === 'running' || results.status === 'paused';

  if (results.status === 'finished') {
    const served = results.arms.find((a) => a.armId === results.winnerArmId);
    return (
      <Alert>
        <CheckCircle2 aria-hidden="true" />
        <AlertTitle>{t('results.finished.title')}</AlertTitle>
        <AlertDescription>
          {served
            ? t('results.finished.serving', { name: served.name })
            : t('results.finished.original')}
        </AlertDescription>
      </Alert>
    );
  }

  const content = {
    collecting: {
      icon: Clock,
      title: t('results.verdict.collecting.title'),
      description: t('results.verdict.collecting.description', {
        count: verdict.status === 'collecting' ? verdict.minVisitors : 0,
      }),
    },
    winner: {
      icon: Trophy,
      title: t('results.verdict.winner.title', { name: winnerArm?.name ?? '' }),
      description: t('results.verdict.winner.description', {
        probability: probability(verdict.status === 'winner' ? verdict.probability : 0, locale),
        uplift: winnerArm?.uplift != null ? signedPercent(winnerArm.uplift, locale) : '',
      }),
    },
    control: {
      icon: Minus,
      title: t('results.verdict.control.title'),
      description: t('results.verdict.control.description', {
        probability: probability(verdict.status === 'control' ? verdict.probability : 0, locale),
      }),
    },
    beats_control: {
      icon: CheckCircle2,
      title: t('results.verdict.beatsControl.title'),
      description: t('results.verdict.beatsControl.description', {
        names: results.arms
          .filter((a) => verdict.status === 'beats_control' && verdict.armIds.includes(a.armId))
          .map((a) => a.name)
          .join(', '),
      }),
    },
    no_difference: {
      icon: Minus,
      title: t('results.verdict.noDifference.title'),
      description: t('results.verdict.noDifference.description'),
    },
  }[verdict.status];
  const Icon = content.icon;

  return (
    <section
      className={cn(
        'flex flex-wrap items-center gap-4 rounded-xl border p-4',
        verdict.status === 'winner' && 'border-primary/40 bg-primary/5',
      )}
      aria-live="polite"
    >
      <div
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-full',
          verdict.status === 'winner'
            ? 'bg-primary/15 text-primary'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="font-medium">{content.title}</p>
        <p className="text-sm text-muted-foreground">{content.description}</p>
      </div>
      {canEdit && live && verdict.status === 'winner' && (
        <Button
          onClick={() =>
            act.mutate(
              { action: 'finish', winnerArmId: verdict.armId },
              {
                onSuccess: () => toast.success(t('results.toasts.applied')),
                onError: () => toast.error(t('common.errors.generic')),
              },
            )
          }
          disabled={act.isPending}
        >
          <Trophy />
          {t('results.applyWinner')}
        </Button>
      )}
    </section>
  );
}

function ArmsTable({
  arms,
  locale,
  compact,
}: {
  arms: ArmResult[];
  locale: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-medium">
              {t('results.table.version')}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t('results.table.visitors')}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t('results.table.conversions')}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t('results.table.rate')}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t('results.table.uplift')}
            </th>
            <th scope="col" className="py-2 pl-3 font-medium">
              {t('results.table.probBeat')}
            </th>
          </tr>
        </thead>
        <tbody>
          {arms.map((arm, i) => (
            <tr key={arm.armId} className="border-b last:border-b-0">
              <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                <span className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: seriesColor(i) }}
                    aria-hidden="true"
                  />
                  {arm.name}
                  {arm.isControl && (
                    <Badge variant="outline" className="font-normal">
                      {t('results.table.baseline')}
                    </Badge>
                  )}
                </span>
              </th>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {integer(arm.visitors, locale)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {integer(arm.conversions, locale)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {percent(arm.rate, locale)}
                {!compact && arm.visitors > 0 && (
                  <span className="block text-xs text-muted-foreground">
                    {percent(arm.rateInterval[0], locale)} – {percent(arm.rateInterval[1], locale)}
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {arm.uplift == null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <>
                    <span
                      className={cn(
                        arm.upliftInterval &&
                          arm.upliftInterval[0] > 0 &&
                          'text-emerald-700 dark:text-emerald-400',
                        arm.upliftInterval && arm.upliftInterval[1] < 0 && 'text-destructive',
                      )}
                    >
                      {signedPercent(arm.uplift, locale)}
                    </span>
                    {!compact && arm.upliftInterval && (
                      <span className="block text-xs text-muted-foreground">
                        {signedPercent(arm.upliftInterval[0], locale, 0)} –{' '}
                        {signedPercent(arm.upliftInterval[1], locale, 0)}
                      </span>
                    )}
                  </>
                )}
              </td>
              <td className="py-2.5 pl-3">
                {arm.probBeatControl == null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(arm.probBeatControl * 100)}
                      aria-label={t('results.table.probBeat')}
                    >
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${arm.probBeatControl * 100}%` }}
                      />
                    </span>
                    <span className="tabular-nums">
                      {probability(arm.probBeatControl, locale, 0)}
                    </span>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SimulationCard({ projectId, results }: { projectId: string; results: ExperimentResults }) {
  const { t } = useTranslation();
  const simulate = useSimulateTraffic(projectId);
  const clear = useClearSimulation(projectId);
  const live = results.status === 'running' || results.status === 'paused';

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary" aria-hidden="true" />
          {t('results.simulation.title')}
        </CardTitle>
        <CardDescription>{t('results.simulation.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() =>
            simulate.mutate(
              { days: 14, visitorsPerDay: 400 },
              {
                onSuccess: () => toast.success(t('results.toasts.simulated')),
                onError: () => toast.error(t('common.errors.generic')),
              },
            )
          }
          disabled={!live || simulate.isPending}
        >
          {simulate.isPending ? <Loader2 className="animate-spin" /> : <FlaskConical />}
          {t(results.simulated ? 'results.simulation.rerun' : 'results.simulation.run')}
        </Button>
        {results.simulated && (
          <Button
            variant="ghost"
            onClick={() =>
              clear.mutate(undefined, {
                onSuccess: () => toast.success(t('results.toasts.cleared')),
              })
            }
            disabled={clear.isPending}
          >
            <Trash2 />
            {t('results.simulation.clear')}
          </Button>
        )}
        {!live && (
          <p className="text-sm text-muted-foreground">{t('results.simulation.needsLive')}</p>
        )}
      </CardContent>
    </Card>
  );
}
