import {
  type Brief,
  FORMALITIES,
  FUNNEL_STAGES,
  READING_LEVELS,
  REGULATED_INDUSTRIES,
  RISK_LEVELS,
  TONES,
} from '@uplift/shared';
import { ShieldAlert } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { Controller, type FieldPath, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router';
import { toast } from 'sonner';
import { MultiChoice, SingleChoice } from '@/components/choice-group';
import { TagInput } from '@/components/tag-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentOrg } from '@/features/organizations/use-current-org';
import { useProjectContext } from '@/features/projects/project-steps';
import { formatRelative } from '@/lib/format';
import { useBrief, useSaveBrief } from './api';
import { BriefCompleteness } from './brief-completeness';

export function BriefPage() {
  const { project } = useProjectContext();
  const { data, isPending, isError } = useBrief(project.id);
  const { t } = useTranslation();

  if (isPending) {
    return (
      <div className="grid gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-56 w-full" />
        ))}
      </div>
    );
  }
  if (isError) return <p>{t('common.errors.loadFailed')}</p>;
  // Keyed so the form starts from the saved brief whenever it is (re)loaded from the server.
  return (
    <BriefForm key={data.updatedAt ?? 'new'} initial={data.brief} updatedAt={data.updatedAt} />
  );
}

function BriefForm({ initial, updatedAt }: { initial: Brief; updatedAt: string | null }) {
  const { t, i18n } = useTranslation();
  const { project } = useProjectContext();
  const org = useCurrentOrg();
  const save = useSaveBrief(project.id);
  const form = useForm<Brief>({ defaultValues: initial });
  const { isDirty } = form.formState;
  const brief = useWatch({ control: form.control }) as Brief;
  const disabled = !org.canEdit || save.isPending;

  // Leaving the page with unsaved changes asks first, both inside the app and when closing the tab.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: () => toast.success(t('brief.saved')),
      onError: () => toast.error(t('common.errors.generic')),
    }),
  );

  const options = <T extends string>(values: readonly T[], key: string) =>
    values.map((value) => ({ value, label: t(`brief.options.${key}.${value}`) }));

  const regulated = (REGULATED_INDUSTRIES as readonly string[]).includes(project.industry);

  const textField = (name: FieldPath<Brief>, rows = 2) => (
    <Field name={name}>
      <Textarea
        id={name}
        rows={rows}
        placeholder={t(`brief.placeholders.${name}`)}
        disabled={disabled}
        {...form.register(name)}
      />
    </Field>
  );

  const tagField = (
    name: FieldPath<Brief>,
    props: { maxItems: number; maxLength?: number; splitOnComma?: boolean },
  ) => (
    <Field name={name}>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <TagInput
            id={name}
            value={field.value as string[]}
            onChange={field.onChange}
            placeholder={t(`brief.placeholders.${name}`)}
            disabled={disabled}
            aria-describedby={`${name}-hint`}
            {...props}
          />
        )}
      />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]" noValidate>
      <div className="grid content-start gap-6">
        <Section
          id="business"
          title={t('brief.sections.business')}
          description={t('brief.sectionDescriptions.business')}
        >
          {textField('business.offering', 3)}
          {textField('business.audience')}
          {textField('business.pageGoal')}
          <Controller
            control={form.control}
            name="business.funnelStage"
            render={({ field }) => (
              <SingleChoice
                name="funnelStage"
                legend={t('brief.fields.business.funnelStage')}
                options={options(FUNNEL_STAGES, 'funnelStage')}
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          {tagField('business.valueProps', { maxItems: 20 })}
          {tagField('business.objections', { maxItems: 20 })}
        </Section>

        <Section
          id="voice"
          title={t('brief.sections.voice')}
          description={t('brief.sectionDescriptions.voice')}
        >
          <Controller
            control={form.control}
            name="voice.tones"
            render={({ field }) => (
              <MultiChoice
                legend={t('brief.fields.voice.tones')}
                hint={t('brief.hints.voice.tones')}
                options={options(TONES, 'tone')}
                value={field.value}
                onChange={field.onChange}
                max={3}
                disabled={disabled}
              />
            )}
          />
          <Controller
            control={form.control}
            name="voice.formality"
            render={({ field }) => (
              <SingleChoice
                name="formality"
                legend={t('brief.fields.voice.formality')}
                options={options(FORMALITIES, 'formality')}
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          <Controller
            control={form.control}
            name="voice.readingLevel"
            render={({ field }) => (
              <SingleChoice
                name="readingLevel"
                legend={t('brief.fields.voice.readingLevel')}
                options={options(READING_LEVELS, 'readingLevel')}
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          {textField('voice.notes', 3)}
        </Section>

        <Section
          id="truth"
          title={t('brief.sections.truth')}
          description={t('brief.sectionDescriptions.truth')}
        >
          {tagField('truth.facts', { maxItems: 40 })}
          {tagField('truth.forbiddenClaims', { maxItems: 40 })}
        </Section>

        <Section
          id="guardrails"
          title={t('brief.sections.guardrails')}
          description={t('brief.sectionDescriptions.guardrails')}
        >
          {regulated && brief.guardrails.riskLevel !== 'high' && (
            <Alert>
              <ShieldAlert aria-hidden="true" />
              <AlertTitle>{t('brief.regulated.title')}</AlertTitle>
              <AlertDescription className="grid justify-items-start gap-2">
                {t('brief.regulated.description', {
                  industry: t(`projects.industries.${project.industry}`),
                })}
                {org.canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      form.setValue('guardrails.riskLevel', 'high', { shouldDirty: true })
                    }
                  >
                    {t('brief.regulated.apply')}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          <Controller
            control={form.control}
            name="guardrails.riskLevel"
            render={({ field }) => (
              <SingleChoice
                name="riskLevel"
                legend={t('brief.fields.guardrails.riskLevel')}
                options={RISK_LEVELS.map((value) => ({
                  value,
                  label: t(`brief.options.riskLevel.${value}`),
                  description: t(`brief.options.riskLevelDescriptions.${value}`),
                }))}
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          {tagField('guardrails.bannedWords', { maxItems: 100, maxLength: 60, splitOnComma: true })}
          {tagField('guardrails.requiredMentions', { maxItems: 20 })}
          {tagField('guardrails.disclaimers', { maxItems: 10, maxLength: 1000 })}
          {tagField('guardrails.avoidStyles', { maxItems: 20 })}
        </Section>
      </div>

      <aside className="grid content-start gap-4 lg:sticky lg:top-6 lg:self-start">
        <BriefCompleteness brief={brief} />
        {org.canEdit && (
          <div className="grid gap-2 rounded-xl border p-4">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {isDirty
                ? t('brief.unsaved')
                : updatedAt
                  ? t('brief.lastSaved', {
                      when: formatRelative(updatedAt, i18n.resolvedLanguage ?? 'en'),
                    })
                  : t('brief.neverSaved')}
            </p>
            <Button type="submit" disabled={!isDirty || save.isPending}>
              {t('brief.save')}
            </Button>
            {isDirty && (
              <Button type="button" variant="ghost" onClick={() => form.reset()}>
                {t('brief.discard')}
              </Button>
            )}
          </div>
        )}
      </aside>

      <AlertDialog open={blocker.state === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('brief.leave.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('brief.leave.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>
              {t('brief.leave.stay')}
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => blocker.proceed?.()}>
              {t('brief.leave.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card id={`brief-${id}`} className="scroll-mt-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">{children}</CardContent>
    </Card>
  );
}

/** Label + control + hint for a brief field; texts come from `brief.fields.*` and `brief.hints.*`. */
function Field({ name, children }: { name: FieldPath<Brief>; children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const hintKey = `brief.hints.${name}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{t(`brief.fields.${name}`)}</Label>
      {children}
      {i18n.exists(hintKey) && (
        <p id={`${name}-hint`} className="text-sm text-muted-foreground">
          {t(hintKey)}
        </p>
      )}
    </div>
  );
}
