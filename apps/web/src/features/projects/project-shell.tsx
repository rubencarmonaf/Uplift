import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentOrg } from '@/features/organizations/use-current-org';
import { ApiError } from '@/lib/api';
import { displayUrl } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useProject } from './api';
import { ProjectActions } from './project-actions';
import { PROJECT_STEPS } from './project-steps';
import { StatusBadge } from './status-badge';

export function ProjectShell() {
  const { t } = useTranslation();
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const org = useCurrentOrg();
  const { data: project, isPending, error } = useProject(projectId);

  if (isPending) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !project) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <div className="grid justify-items-start gap-4">
        <h1 className="text-xl font-medium">
          {t(notFound ? 'projects.notFound' : 'common.errors.loadFailed')}
        </h1>
        <Button asChild variant="outline">
          <Link to="/projects">
            <ArrowLeft />
            {t('projects.backToList')}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Link
        to="/projects"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('projects.title')}
      </Link>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{project.name}</h1>
            <StatusBadge status={project.status} archived={!!project.archivedAt} />
          </div>
          <a
            href={project.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {displayUrl(project.url)}
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </div>
        {org.canEdit && (
          <ProjectActions
            project={project}
            onDeleted={() => void navigate('/projects', { replace: true })}
          />
        )}
      </header>

      <nav
        aria-label={t('projects.stepsLabel')}
        className="-mx-4 mb-8 overflow-x-auto px-4 md:mx-0 md:px-0"
      >
        <ol className="flex w-max min-w-full gap-1 border-b">
          {PROJECT_STEPS.map((step, index) => (
            <li key={step}>
              <NavLink
                to={step === 'overview' ? '' : step}
                end
                className={({ isActive }) =>
                  cn(
                    '-mb-px flex items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                    isActive && 'border-primary text-foreground',
                  )
                }
              >
                <span className="grid size-5 place-items-center rounded-full bg-muted text-xs tabular-nums">
                  {index + 1}
                </span>
                {t(`projects.steps.${step}`)}
              </NavLink>
            </li>
          ))}
        </ol>
      </nav>

      <Outlet context={{ project }} />
    </>
  );
}
