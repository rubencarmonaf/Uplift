import { Construction } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ProjectStep } from './project-steps';

export function ProjectStepPlaceholder({ step }: { step: ProjectStep }) {
  const { t } = useTranslation();
  return (
    <section className="grid place-items-center rounded-xl border border-dashed px-6 py-16 text-center">
      <div className="grid max-w-md justify-items-center gap-3">
        <Construction className="size-8 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-medium">{t(`projects.steps.${step}`)}</h2>
        <p className="text-sm text-muted-foreground">{t(`projects.stepDescriptions.${step}`)}</p>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t('comingSoon')}
        </p>
      </div>
    </section>
  );
}
