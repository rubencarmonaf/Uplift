import type { PageElement } from '@uplift/shared';
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
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
import { cn } from '@/lib/utils';
import { useDeleteElement } from './api';
import { ElementDialog } from './element-dialog';

export function ElementCard({
  element,
  index,
  canEdit,
  onMoveUp,
  onMoveDown,
}: {
  element: PageElement;
  index: number;
  canEdit: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const { t } = useTranslation();
  const remove = useDeleteElement(element.projectId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const length = element.originalText.length;
  const overLimit = element.maxLength != null && length > element.maxLength;

  return (
    <li className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-4">
      <span className="hidden size-7 place-items-center rounded-full bg-muted text-sm font-medium tabular-nums sm:grid">
        {index + 1}
      </span>

      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">{element.name}</h3>
          <Badge variant="secondary">{t(`elements.types.${element.type}`)}</Badge>
        </div>
        <code className="w-fit max-w-full truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
          {element.selector}
        </code>
        <blockquote className="border-l-2 pl-3 text-sm break-words">
          {element.originalText}
        </blockquote>
        <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span className={cn('tabular-nums', overLimit && 'text-amber-600 dark:text-amber-400')}>
            {t('elements.charCount', { count: length })}
          </span>
          {(element.minLength != null || element.maxLength != null) && (
            <span className="tabular-nums">
              {t('elements.limits', {
                min: element.minLength ?? '—',
                max: element.maxLength ?? '—',
              })}
            </span>
          )}
        </p>
        {element.notes && <p className="text-sm text-muted-foreground">{element.notes}</p>}
      </div>

      {canEdit && (
        <div className="flex items-start gap-1 sm:flex-col sm:items-end">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onMoveUp}
              disabled={!onMoveUp}
              aria-label={t('elements.actions.moveUp', { name: element.name })}
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onMoveDown}
              disabled={!onMoveDown}
              aria-label={t('elements.actions.moveDown', { name: element.name })}
            >
              <ArrowDown />
            </Button>
          </div>
          <div className="flex gap-1">
            <ElementDialog
              projectId={element.projectId}
              element={element}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('elements.actions.edit', { name: element.name })}
                >
                  <Pencil />
                </Button>
              }
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConfirmDelete(true)}
              aria-label={t('elements.actions.delete', { name: element.name })}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('elements.deleteTitle', { name: element.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t('elements.deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                remove.mutate(element.id, {
                  onSuccess: () => toast.success(t('elements.toasts.deleted')),
                  onError: () => toast.error(t('common.errors.generic')),
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
