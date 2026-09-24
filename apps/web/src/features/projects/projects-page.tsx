import { FolderPlus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';

export function ProjectsPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader
        title={t('projects.title')}
        description={t('projects.description')}
        actions={
          <Button disabled>
            <Plus />
            {t('projects.empty.cta')}
          </Button>
        }
      />
      <section className="grid place-items-center rounded-xl border border-dashed px-6 py-16 text-center">
        <div className="grid max-w-sm justify-items-center gap-3">
          <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <FolderPlus className="size-6" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-medium">{t('projects.empty.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('projects.empty.description')}</p>
        </div>
      </section>
    </>
  );
}
