import type { ProjectStatus } from '@uplift/shared';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STYLES: Record<ProjectStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  ready: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  running: 'bg-primary/15 text-primary',
  finished: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
};

export function StatusBadge({ status, archived }: { status: ProjectStatus; archived?: boolean }) {
  const { t } = useTranslation();
  if (archived) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {t('projects.archived')}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={cn('gap-1.5 border-transparent', STYLES[status])}>
      {status === 'running' && (
        <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />
      )}
      {t(`projects.statuses.${status}`)}
    </Badge>
  );
}
