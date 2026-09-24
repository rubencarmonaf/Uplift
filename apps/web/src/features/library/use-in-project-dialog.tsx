import type { LibraryItem } from '@uplift/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { SelectField } from '@/components/select-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useElements } from '@/features/elements/api';
import { useCurrentOrg } from '@/features/organizations/use-current-org';
import { useProjects } from '@/features/projects/api';
import { useCreateVariant } from '@/features/variants/api';

/** Copies a library item into another project as a new (manual) variant of one of its elements. */
export function UseInProjectDialog({
  item,
  onOpenChange,
}: {
  item: LibraryItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const org = useCurrentOrg();
  const projects = useProjects(org.id, { sort: 'updated' });
  const [projectId, setProjectId] = useState<string | undefined>();
  const [elementId, setElementId] = useState<string | undefined>();
  const elements = useElements(projectId ?? '');
  const create = useCreateVariant(projectId ?? '');
  const [done, setDone] = useState<string | null>(null);

  const close = (open: boolean) => {
    if (!open) {
      setProjectId(undefined);
      setElementId(undefined);
      setDone(null);
    }
    onOpenChange(open);
  };

  // Prefer elements of the same type as the item.
  const elementOptions = (projectId ? (elements.data ?? []) : [])
    .slice()
    .sort((a, b) => Number(b.type === item?.elementType) - Number(a.type === item?.elementType))
    .map((e) => ({ value: e.id, label: `${e.name} · ${t(`elements.types.${e.type}`)}` }));

  return (
    <Dialog open={item !== null} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('library.use.title')}</DialogTitle>
          <DialogDescription>{t('library.use.description')}</DialogDescription>
        </DialogHeader>
        {item && (
          <blockquote className="rounded-lg border-l-2 border-primary bg-muted/50 px-3 py-2 text-sm">
            {item.text}
          </blockquote>
        )}
        {done ? (
          <p className="text-sm">
            {t('library.use.done')}{' '}
            <Link
              to={`/projects/${done}/variants`}
              className="font-medium text-primary underline underline-offset-4"
            >
              {t('library.use.goToVariants')}
            </Link>
          </p>
        ) : (
          <div className="grid gap-4">
            <SelectField
              id="use-project"
              label={t('library.use.project')}
              placeholder={t('projects.placeholders.select')}
              value={projectId}
              onChange={(v) => {
                setProjectId(v);
                setElementId(undefined);
              }}
              options={(projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
            <SelectField
              id="use-element"
              label={t('library.use.element')}
              placeholder={
                projectId && elementOptions.length === 0
                  ? t('library.use.noElements')
                  : t('projects.placeholders.select')
              }
              value={elementId}
              onChange={setElementId}
              options={elementOptions}
              disabled={!projectId || elementOptions.length === 0}
            />
          </div>
        )}
        <DialogFooter>
          {done ? (
            <Button variant="outline" onClick={() => close(false)}>
              {t('library.use.close')}
            </Button>
          ) : (
            <Button
              disabled={!item || !elementId || create.isPending}
              onClick={() =>
                item &&
                elementId &&
                create.mutate(
                  { elementId, text: item.text },
                  {
                    onSuccess: () => setDone(projectId!),
                    onError: () => toast.error(t('common.errors.generic')),
                  },
                )
              }
            >
              {t('library.use.submit')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
