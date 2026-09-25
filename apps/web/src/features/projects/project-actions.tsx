import type { Project } from '@uplift/shared';
import { Archive, ArchiveRestore, Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteProject, useCopyProject, useUpdateProject } from './api';

/** Copy, archive and delete, shared by the projects table and the project header. */
export function ProjectActions({
  project,
  onDeleted,
}: {
  project: Project;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const update = useUpdateProject();
  const copy = useCopyProject();
  const remove = useDeleteProject();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const archived = !!project.archivedAt;
  const onError = () => toast.error(t('common.errors.generic'));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('common.actions')}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              copy.mutate(
                { id: project.id, name: t('projects.copyName', { name: project.name }) },
                {
                  onSuccess: (copy) => {
                    toast.success(t('projects.toasts.copied'));
                    void navigate(`/projects/${copy.id}`);
                  },
                  onError,
                },
              )
            }
          >
            <Copy />
            {t('projects.actions.copy')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              update.mutate(
                { id: project.id, archived: !archived },
                {
                  onSuccess: () =>
                    toast.success(
                      t(archived ? 'projects.toasts.unarchived' : 'projects.toasts.archived'),
                    ),
                  onError,
                },
              )
            }
          >
            {archived ? <ArchiveRestore /> : <Archive />}
            {t(archived ? 'projects.actions.unarchive' : 'projects.actions.archive')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2 />
            {t('projects.actions.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('projects.deleteTitle', { name: project.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t('projects.deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                remove.mutate(project.id, {
                  onSuccess: () => {
                    toast.success(t('projects.toasts.deleted'));
                    onDeleted?.();
                  },
                  onError,
                })
              }
            >
              {t('projects.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
