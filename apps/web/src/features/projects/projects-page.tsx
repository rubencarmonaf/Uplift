import { PROJECT_STATUSES, type ListProjectsQuery, type ProjectStatus } from '@uplift/shared';
import { FolderPlus, Search, SearchX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCurrentOrg } from '@/features/organizations/use-current-org';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { displayUrl, formatDateTime, formatRelative } from '@/lib/format';
import { useProjects } from './api';
import { NewProjectDialog } from './new-project-dialog';
import { ProjectActions } from './project-actions';
import { StatusBadge } from './status-badge';

type View = 'active' | 'archived';
type Sort = NonNullable<ListProjectsQuery['sort']>;
const ALL = 'all';

export function ProjectsPage() {
  const { t, i18n } = useTranslation();
  const org = useCurrentOrg();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | typeof ALL>(ALL);
  const [view, setView] = useState<View>('active');
  const [sort, setSort] = useState<Sort>('updated');
  const q = useDebouncedValue(search.trim());

  const query: ListProjectsQuery = {
    q: q || undefined,
    status: status === ALL ? undefined : status,
    archived: view === 'archived' ? 'true' : undefined,
    sort,
  };
  const { data: projects, isPending, isError, refetch } = useProjects(org.id, query);
  const isFiltered = !!q || status !== ALL || view === 'archived';
  const locale = i18n.resolvedLanguage ?? 'en';

  return (
    <>
      <PageTitle
        title={t('projects.title')}
        description={t('projects.description')}
        actions={<NewProjectDialog />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('projects.searchPlaceholder')}
            aria-label={t('projects.searchPlaceholder')}
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-40" aria-label={t('projects.fields.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('projects.allStatuses')}</SelectItem>
            {PROJECT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`projects.statuses.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={view} onValueChange={(v) => setView(v as View)}>
          <SelectTrigger className="w-36" aria-label={t('projects.view')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t('projects.views.active')}</SelectItem>
            <SelectItem value="archived">{t('projects.views.archived')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="w-44 sm:ml-auto" aria-label={t('projects.sortBy')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">{t('projects.sorts.updated')}</SelectItem>
            <SelectItem value="created">{t('projects.sorts.created')}</SelectItem>
            <SelectItem value="name">{t('projects.sorts.name')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div className="grid gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={SearchX}
          title={t('common.errors.loadFailed')}
          action={
            <Button variant="outline" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : projects.length === 0 ? (
        isFiltered ? (
          <EmptyState icon={SearchX} title={t('projects.noResults')} />
        ) : (
          <EmptyState
            icon={FolderPlus}
            title={t('projects.empty.title')}
            description={t('projects.empty.description')}
            action={org.canEdit && <NewProjectDialog />}
          />
        )
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('projects.fields.name')}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('projects.fields.pageType')}
                </TableHead>
                <TableHead>{t('projects.fields.status')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('projects.updated')}</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">{t('common.actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="max-w-72">
                    <Link
                      to={`/projects/${project.id}`}
                      className="block truncate font-medium hover:underline"
                    >
                      {project.name}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">
                      {displayUrl(project.url)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {t(`projects.pageTypes.${project.pageType}`)} ·{' '}
                    {t(`projects.industries.${project.industry}`)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={project.status} archived={!!project.archivedAt} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    <time
                      dateTime={project.updatedAt}
                      title={formatDateTime(project.updatedAt, locale)}
                    >
                      {formatRelative(project.updatedAt, locale)}
                    </time>
                  </TableCell>
                  <TableCell>{org.canEdit && <ProjectActions project={project} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="grid place-items-center rounded-xl border border-dashed px-6 py-16 text-center">
      <div className="grid max-w-sm justify-items-center gap-3">
        <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-6" />
        </div>
        <h2 className="text-lg font-medium">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        {action}
      </div>
    </section>
  );
}
