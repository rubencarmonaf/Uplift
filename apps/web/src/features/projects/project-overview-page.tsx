import { PROJECT_STATUSES, type ProjectStatus } from '@uplift/shared';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCurrentOrg } from '@/features/organizations/use-current-org';
import { formatDateTime } from '@/lib/format';
import { useUpdateProject } from './api';
import { ProjectForm } from './project-form';
import { useProjectContext } from './project-steps';

export function ProjectOverviewPage() {
  const { t, i18n } = useTranslation();
  const { project } = useProjectContext();
  const org = useCurrentOrg();
  const update = useUpdateProject();
  const locale = i18n.resolvedLanguage ?? 'en';
  const onError = () => toast.error(t('common.errors.generic'));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <Card>
        <CardHeader>
          <CardTitle>{t('projects.overview.detailsTitle')}</CardTitle>
          <CardDescription>{t('projects.overview.detailsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Keyed by updatedAt so the form resets to the saved values after each save. */}
          <ProjectForm
            key={project.updatedAt}
            id="project-details"
            defaultValues={project}
            disabled={!org.canEdit || update.isPending}
            onSubmit={(values) =>
              update.mutate(
                { id: project.id, ...values },
                { onSuccess: () => toast.success(t('projects.toasts.saved')), onError },
              )
            }
            footer={
              org.canEdit && (
                <div className="flex justify-end">
                  <Button type="submit" disabled={update.isPending}>
                    {t('common.save')}
                  </Button>
                </div>
              )
            }
          />
        </CardContent>
      </Card>

      <aside className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('projects.fields.status')}</CardTitle>
            <CardDescription>{t('projects.overview.statusDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={project.status}
              disabled={!org.canEdit || update.isPending}
              onValueChange={(status) =>
                update.mutate({ id: project.id, status: status as ProjectStatus }, { onError })
              }
            >
              <SelectTrigger className="w-full" aria-label={t('projects.fields.status')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`projects.statuses.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <dl className="grid gap-3 px-1 text-sm">
          <div>
            <dt className="text-muted-foreground">{t('projects.created')}</dt>
            <dd>{formatDateTime(project.createdAt, locale)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('projects.updated')}</dt>
            <dd>{formatDateTime(project.updatedAt, locale)}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
