import { Lightbulb, MousePointerClick, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentOrg } from '@/features/organizations/use-current-org';
import { useProjectContext } from '@/features/projects/project-steps';
import { useElements, useReorderElements } from './api';
import { ElementCard } from './element-card';
import { ElementDialog } from './element-dialog';

export function ElementsPage() {
  const { t } = useTranslation();
  const { project } = useProjectContext();
  const org = useCurrentOrg();
  const { data: elements, isPending, isError, refetch } = useElements(project.id);
  const reorder = useReorderElements(project.id);

  const move = (from: number, to: number) => {
    if (!elements) return;
    const ids = elements.map((e) => e.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved!);
    reorder.mutate(ids);
  };

  const addButton = (
    <ElementDialog
      projectId={project.id}
      trigger={
        <Button>
          <Plus />
          {t('elements.add')}
        </Button>
      }
    />
  );

  if (isPending) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-36 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="grid justify-items-start gap-3">
        <p>{t('common.errors.loadFailed')}</p>
        <Button variant="outline" onClick={() => void refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="grid content-start gap-4" aria-labelledby="elements-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="elements-heading" className="text-lg font-medium">
              {t('elements.title')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('elements.count', { count: elements.length })}
            </p>
          </div>
          {org.canEdit && elements.length > 0 && addButton}
        </div>

        {elements.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed px-6 py-14 text-center">
            <div className="grid max-w-sm justify-items-center gap-3">
              <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                <MousePointerClick className="size-6" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-medium">{t('elements.empty.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('elements.empty.description')}</p>
              {org.canEdit && addButton}
            </div>
          </div>
        ) : (
          <ol className="grid gap-3">
            {elements.map((element, index) => (
              <ElementCard
                key={element.id}
                element={element}
                index={index}
                canEdit={org.canEdit}
                onMoveUp={index > 0 ? () => move(index, index - 1) : undefined}
                onMoveDown={index < elements.length - 1 ? () => move(index, index + 1) : undefined}
              />
            ))}
          </ol>
        )}
      </section>

      <aside className="h-fit rounded-xl border bg-muted/40 p-4 text-sm">
        <h3 className="mb-2 flex items-center gap-2 font-medium">
          <Lightbulb className="size-4 text-primary" aria-hidden="true" />
          {t('elements.tips.title')}
        </h3>
        <ol className="grid list-decimal gap-2 pl-4 text-muted-foreground">
          <li>{t('elements.tips.step1')}</li>
          <li>{t('elements.tips.step2')}</li>
          <li>{t('elements.tips.step3')}</li>
        </ol>
        <p className="mt-3 text-muted-foreground">{t('elements.tips.stable')}</p>
      </aside>
    </div>
  );
}
