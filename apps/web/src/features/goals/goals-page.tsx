import type { Goal, PickedElement } from '@uplift/shared';
import { Pencil, Plus, Star, Target, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Skeleton } from '@/components/ui/skeleton';
import { PagePickerDialog } from '@/features/elements/page-picker-dialog';
import { useCurrentOrg } from '@/features/organizations/use-current-org';
import { useProjectContext } from '@/features/projects/project-steps';
import { useDeleteGoal, useGoals, useUpdateGoal } from './api';
import { GoalDialog } from './goal-dialog';
import { GOAL_ICONS } from './goal-icons';

type Editing = { goal?: Goal } | null;

export function GoalsPage() {
  const { t } = useTranslation();
  const { project } = useProjectContext();
  const org = useCurrentOrg();
  const { data: goals, isPending, isError } = useGoals(project.id);
  const [editing, setEditing] = useState<Editing>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<PickedElement | null>(null);

  // The picker temporarily replaces the goal dialog and hands the chosen element back to it.
  const onPick = useCallback((element: PickedElement) => {
    setPicked(element);
    setPickerOpen(false);
  }, []);

  const openDialog = (goal?: Goal) => {
    setPicked(null);
    setEditing({ goal });
  };

  if (isPending) return <Skeleton className="h-48 w-full" />;
  if (isError) return <p>{t('common.errors.loadFailed')}</p>;

  const clickSelectors = goals.flatMap((g) =>
    g.target.kind === 'click' ? [g.target.selector] : [],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="grid content-start gap-4" aria-labelledby="goals-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="goals-heading" className="text-lg font-medium">
              {t('goals.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('goals.description')}</p>
          </div>
          {org.canEdit && goals.length > 0 && (
            <Button onClick={() => openDialog()}>
              <Plus />
              {t('goals.add')}
            </Button>
          )}
        </div>

        {goals.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed px-6 py-14 text-center">
            <div className="grid max-w-sm justify-items-center gap-3">
              <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Target className="size-6" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-medium">{t('goals.empty.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('goals.empty.description')}</p>
              {org.canEdit && (
                <Button onClick={() => openDialog()}>
                  <Plus />
                  {t('goals.add')}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <ul className="grid gap-3">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                canEdit={org.canEdit}
                onEdit={() => openDialog(goal)}
              />
            ))}
          </ul>
        )}
      </section>

      <aside className="h-fit rounded-xl border bg-muted/40 p-4 text-sm">
        <h3 className="mb-2 flex items-center gap-2 font-medium">
          <Star className="size-4 text-primary" aria-hidden="true" />
          {t('goals.primaryHelp.title')}
        </h3>
        <p className="text-muted-foreground">{t('goals.primaryHelp.description')}</p>
      </aside>

      {editing && (
        <GoalDialog
          key={editing.goal?.id ?? 'new'}
          project={project}
          goal={editing.goal}
          open={!pickerOpen}
          onOpenChange={(open) => !open && !pickerOpen && setEditing(null)}
          onPickOnPage={() => setPickerOpen(true)}
          picked={picked}
        />
      )}
      <PagePickerDialog
        project={project}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        existingSelectors={clickSelectors}
        onPick={onPick}
      />
    </div>
  );
}

function GoalCard({ goal, canEdit, onEdit }: { goal: Goal; canEdit: boolean; onEdit: () => void }) {
  const { t } = useTranslation();
  const update = useUpdateGoal(goal.projectId);
  const remove = useDeleteGoal(goal.projectId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const Icon = GOAL_ICONS[goal.target.kind];
  const onError = () => toast.error(t('common.errors.generic'));

  const detail =
    goal.target.kind === 'click'
      ? goal.target.selector
      : goal.target.kind === 'pageview'
        ? `${t(`goals.matches.${goal.target.match}`)}: ${goal.target.value}`
        : goal.target.eventName;

  return (
    <li className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">{goal.name}</h3>
          {goal.isPrimary ? (
            <Badge className="gap-1">
              <Star className="size-3 fill-current" aria-hidden="true" />
              {t('goals.primary')}
            </Badge>
          ) : (
            <Badge variant="outline">{t('goals.secondary')}</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {t(`goals.kinds.${goal.target.kind}`)} ·{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs break-all">{detail}</code>
        </p>
      </div>
      {canEdit && (
        <div className="flex gap-1">
          {!goal.isPrimary && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                update.mutate(
                  { id: goal.id, isPrimary: true },
                  { onSuccess: () => toast.success(t('goals.toasts.primary')), onError },
                )
              }
            >
              <Star />
              {t('goals.makePrimary')}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            aria-label={t('goals.actions.edit', { name: goal.name })}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmDelete(true)}
            aria-label={t('goals.actions.delete', { name: goal.name })}
          >
            <Trash2 />
          </Button>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('goals.deleteTitle', { name: goal.name })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(goal.isPrimary ? 'goals.deletePrimaryDescription' : 'goals.deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                remove.mutate(goal.id, {
                  onSuccess: () => toast.success(t('goals.toasts.deleted')),
                  onError,
                })
              }
            >
              {t('projects.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
