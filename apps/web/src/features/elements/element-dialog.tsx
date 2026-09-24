import type { PageElement } from '@uplift/shared';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCreateElement, useUpdateElement } from './api';
import { ElementForm, type ElementFormValues } from './element-form';

/** Creates an element, or edits `element` when given. */
export function ElementDialog({
  projectId,
  element,
  trigger,
}: {
  projectId: string;
  element?: PageElement;
  trigger: ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const create = useCreateElement(projectId);
  const update = useUpdateElement(projectId);
  const mutation = element ? update : create;
  const formId = element ? `edit-element-${element.id}` : 'create-element';

  const onSubmit = (values: ElementFormValues) => {
    const options = {
      onSuccess: () => {
        setOpen(false);
        toast.success(t(element ? 'elements.toasts.saved' : 'elements.toasts.created'));
      },
      onError: () => toast.error(t('common.errors.generic')),
    };
    if (element) update.mutate({ id: element.id, ...values }, options);
    else create.mutate(values, options);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) mutation.reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t(element ? 'elements.editTitle' : 'elements.createTitle')}</DialogTitle>
          <DialogDescription>{t('elements.dialogDescription')}</DialogDescription>
        </DialogHeader>
        {open && (
          <ElementForm
            id={formId}
            defaultValues={element}
            disabled={mutation.isPending}
            onSubmit={onSubmit}
          />
        )}
        <DialogFooter>
          <Button type="submit" form={formId} disabled={mutation.isPending}>
            {t(element ? 'common.save' : 'elements.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
