import { type CreateElementInput, type PickedElement, SUGGESTED_MAX_LENGTH } from '@uplift/shared';
import { Lightbulb, MousePointerClick, PencilLine } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentOrg } from '@/features/organizations/use-current-org';
import { useProjectContext } from '@/features/projects/project-steps';
import { useElements, useReorderElements } from './api';
import { ElementCard } from './element-card';
import { ElementDialog } from './element-dialog';
import { PagePickerDialog } from './page-picker-dialog';

/** Turns a click in the page picker into a pre-filled element. */
function fromPick(picked: PickedElement, fallbackName: string): Partial<CreateElementInput> {
  const name = picked.text.length > 40 ? picked.text.slice(0, 40).trimEnd() + '…' : picked.text;
  return {
    name: name || fallbackName,
    type: picked.suggestedType,
    selector: picked.selector,
    originalText: picked.text,
    maxLength: SUGGESTED_MAX_LENGTH[picked.suggestedType] ?? null,
  };
}

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

  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<CreateElementInput> | null>(null);

  const onPick = useCallback(
    (picked: PickedElement) => {
      setPickerOpen(false);
      setDraft(fromPick(picked, t(`elements.types.${picked.suggestedType}`)));
    },
    [t],
  );

  const addButtons = (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setPickerOpen(true)}>
        <MousePointerClick />
        {t('elements.pickOnPage')}
      </Button>
      <Button variant="outline" onClick={() => setDraft({})}>
        <PencilLine />
        {t('elements.addManually')}
      </Button>
    </div>
  );

  const dialogs = (
    <>
      <PagePickerDialog
        project={project}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        existingSelectors={elements?.map((e) => e.selector) ?? []}
        onPick={onPick}
      />
      <ElementDialog
        projectId={project.id}
        open={draft !== null}
        onOpenChange={(open) => !open && setDraft(null)}
        defaultValues={draft ?? undefined}
      />
    </>
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
      {dialogs}
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
          {org.canEdit && elements.length > 0 && addButtons}
        </div>

        {elements.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed px-6 py-14 text-center">
            <div className="grid max-w-sm justify-items-center gap-3">
              <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                <MousePointerClick className="size-6" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-medium">{t('elements.empty.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('elements.empty.description')}</p>
              {org.canEdit && addButtons}
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
