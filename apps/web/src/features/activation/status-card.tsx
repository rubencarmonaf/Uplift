import type { Experiment, Goal } from '@uplift/shared';
import { Check, Circle, Flag, Pause, Play, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useExperimentAction } from './api';

const STATUS_STYLES = {
  draft: 'bg-muted text-muted-foreground',
  running: 'bg-primary/15 text-primary',
  paused: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  finished: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
} as const;

const NO_WINNER = 'none';

export function StatusCard({
  experiment,
  goals,
  canEdit,
  hasUnsavedChanges,
}: {
  experiment: Experiment;
  goals: Goal[];
  canEdit: boolean;
  hasUnsavedChanges: boolean;
}) {
  const { t, i18n } = useTranslation();
  const act = useExperimentAction(experiment.projectId);
  const [finishing, setFinishing] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [winner, setWinner] = useState<string>(NO_WINNER);
  const locale = i18n.resolvedLanguage ?? 'en';

  const checks = [
    {
      id: 'goal',
      done: goals.some((g) => g.isPrimary),
      link: '../goals',
    },
    {
      id: 'variantArm',
      done: experiment.arms.some((a) => !a.isControl && a.weight > 0 && a.changes.length > 0),
      link: null,
    },
    { id: 'saved', done: !hasUnsavedChanges, link: null },
  ];
  const ready = checks.every((c) => c.done);

  const run = (
    action: 'start' | 'pause' | 'resume' | 'finish' | 'reset',
    winnerArmId?: string | null,
  ) =>
    act.mutate(
      { action, winnerArmId },
      {
        onSuccess: () => toast.success(t(`activation.toasts.${action}`)),
        onError: (err) => {
          const reason =
            err instanceof ApiError ? (err.body as { reason?: string }).reason : undefined;
          toast.error(reason ? t(`activation.errors.${reason}`) : t('common.errors.generic'));
        },
      },
    );

  return (
    <section
      className="grid gap-4 rounded-xl border bg-card p-4"
      aria-labelledby="experiment-status"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <div className="flex items-center gap-2">
            <h2 id="experiment-status" className="text-lg font-medium">
              {t('activation.status.title')}
            </h2>
            <Badge
              variant="secondary"
              className={cn('border-transparent', STATUS_STYLES[experiment.status])}
            >
              {t(`activation.statuses.${experiment.status}`)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {experiment.startedAt
              ? t('activation.status.startedAt', {
                  date: formatDateTime(experiment.startedAt, locale),
                })
              : t(`activation.status.hints.${experiment.status}`)}
          </p>
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {experiment.status === 'draft' && (
              <Button onClick={() => run('start')} disabled={!ready || act.isPending}>
                <Play />
                {t('activation.actions.start')}
              </Button>
            )}
            {experiment.status === 'running' && (
              <Button variant="outline" onClick={() => run('pause')} disabled={act.isPending}>
                <Pause />
                {t('activation.actions.pause')}
              </Button>
            )}
            {experiment.status === 'paused' && (
              <Button onClick={() => run('resume')} disabled={act.isPending}>
                <Play />
                {t('activation.actions.resume')}
              </Button>
            )}
            {(experiment.status === 'running' || experiment.status === 'paused') && (
              <Button onClick={() => setFinishing(true)} disabled={act.isPending}>
                <Flag />
                {t('activation.actions.finish')}
              </Button>
            )}
            {experiment.status !== 'draft' && (
              <Button
                variant="ghost"
                onClick={() => setConfirmReset(true)}
                disabled={act.isPending}
              >
                <RotateCcw />
                {t('activation.actions.reset')}
              </Button>
            )}
          </div>
        )}
      </div>

      {experiment.status === 'draft' && (
        <ul className="grid gap-1 text-sm">
          {checks.map((check) => (
            <li key={check.id} className="flex items-center gap-2">
              {check.done ? (
                <Check className="size-4 text-primary" aria-hidden="true" />
              ) : (
                <Circle className="size-4 text-muted-foreground/60" aria-hidden="true" />
              )}
              <span className={cn(check.done && 'text-muted-foreground')}>
                {t(`activation.checks.${check.id}`)}
              </span>
              {!check.done && check.link && (
                <Link
                  to={check.link}
                  relative="path"
                  className="text-primary underline underline-offset-4"
                >
                  {t('activation.checks.fix')}
                </Link>
              )}
              <span className="sr-only">
                {check.done ? t('brief.completeness.done') : t('brief.completeness.pending')}
              </span>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={finishing} onOpenChange={setFinishing}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('activation.finish.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('activation.finish.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="winner">{t('activation.finish.winner')}</Label>
            <Select value={winner} onValueChange={setWinner}>
              <SelectTrigger id="winner" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_WINNER}>{t('activation.finish.noWinner')}</SelectItem>
                {experiment.arms
                  .filter((a) => !a.isControl)
                  .map((arm) => (
                    <SelectItem key={arm.id} value={arm.id}>
                      {arm.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => run('finish', winner === NO_WINNER ? null : winner)}>
              {t('activation.actions.finish')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('activation.resetConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('activation.resetConfirm.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => run('reset')}>
              {t('activation.actions.reset')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
