import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
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
import { useCurrentOrg } from '@/features/organizations/use-current-org';
import { useCreateProject } from './api';
import { ProjectForm } from './project-form';

export function NewProjectDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { t } = useTranslation();
  const org = useCurrentOrg();
  const navigate = useNavigate();
  const create = useCreateProject(org.id);
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) create.reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button disabled={!org.canEdit}>
            <Plus />
            {t('projects.new')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('projects.createTitle')}</DialogTitle>
          <DialogDescription>{t('projects.createDescription')}</DialogDescription>
        </DialogHeader>
        {/* Remounted on every open so the form starts empty. */}
        {open && (
          <ProjectForm
            id="create-project"
            disabled={create.isPending}
            onSubmit={(values) =>
              create.mutate(values, {
                onSuccess: (project) => {
                  setOpen(false);
                  toast.success(t('projects.toasts.created'));
                  void navigate(`/projects/${project.id}`);
                },
                onError: () => toast.error(t('common.errors.generic')),
              })
            }
          />
        )}
        <DialogFooter>
          <Button type="submit" form="create-project" disabled={create.isPending}>
            {t('projects.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
