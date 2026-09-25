import {
  type Goal,
  type GoalKind,
  type GoalTarget,
  goalTargetSchema,
  matchesPageview,
  type PickedElement,
  type Project,
  URL_MATCH_TYPES,
} from '@uplift/shared';
import { Check, MousePointerClick, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FormField } from '@/components/form-field';
import { SelectField } from '@/components/select-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isValidSelector } from '@/features/elements/selector';
import { cn } from '@/lib/utils';
import { useCreateGoal, useUpdateGoal } from './api';
import { GOAL_ICONS } from './goal-icons';

type Draft = {
  name: string;
  kind: GoalKind;
  selector: string;
  match: (typeof URL_MATCH_TYPES)[number];
  value: string;
  eventName: string;
};

const toDraft = (goal?: Goal): Draft => ({
  name: goal?.name ?? '',
  kind: goal?.target.kind ?? 'click',
  selector: goal?.target.kind === 'click' ? goal.target.selector : '',
  match: goal?.target.kind === 'pageview' ? goal.target.match : 'prefix',
  value: goal?.target.kind === 'pageview' ? goal.target.value : '',
  eventName: goal?.target.kind === 'event' ? goal.target.eventName : '',
});

const toTarget = (d: Draft): unknown =>
  d.kind === 'click'
    ? { kind: 'click', selector: d.selector }
    : d.kind === 'pageview'
      ? { kind: 'pageview', match: d.match, value: d.value }
      : { kind: 'event', eventName: d.eventName };

/**
 * Creates or edits a goal. Click goals can be picked on the page; `onPickOnPage` hands control to
 * the page picker and comes back with the chosen element.
 */
export function GoalDialog({
  project,
  goal,
  open,
  onOpenChange,
  onPickOnPage,
  picked,
}: {
  project: Project;
  goal?: Goal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPickOnPage: () => void;
  picked: PickedElement | null;
}) {
  const { t } = useTranslation();
  const create = useCreateGoal(project.id);
  const update = useUpdateGoal(project.id);
  const mutation = goal ? update : create;
  const [draft, setDraft] = useState(() => toDraft(goal));
  const [submitted, setSubmitted] = useState(false);
  const [testUrl, setTestUrl] = useState(project.url);

  // Apply an element chosen in the page picker once, when it arrives.
  const [appliedPick, setAppliedPick] = useState(picked);
  if (picked && picked !== appliedPick) {
    setAppliedPick(picked);
    setDraft((d) => ({
      ...d,
      kind: 'click',
      selector: picked.selector,
      name:
        d.name || t('goals.defaultClickName', { text: picked.text.slice(0, 40) || picked.tagName }),
    }));
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const parsed = goalTargetSchema.safeParse(toTarget(draft));
  const selectorInvalid =
    draft.kind === 'click' && draft.selector !== '' && !isValidSelector(draft.selector);
  const nameMissing = draft.name.trim() === '';
  const valid = parsed.success && !selectorInvalid && !nameMissing;

  const submit = () => {
    setSubmitted(true);
    if (!valid) return;
    const target = parsed.data as GoalTarget;
    const options = {
      onSuccess: () => {
        onOpenChange(false);
        toast.success(t(goal ? 'goals.toasts.saved' : 'goals.toasts.created'));
      },
      onError: () => toast.error(t('common.errors.generic')),
    };
    if (goal) update.mutate({ id: goal.id, name: draft.name.trim(), target }, options);
    else create.mutate({ name: draft.name.trim(), target }, options);
  };

  const fieldError = (show: boolean, key: string) => (submitted && show ? t(key) : undefined);
  const testResult =
    draft.kind === 'pageview' && parsed.success && parsed.data.kind === 'pageview'
      ? matchesPageview(parsed.data, testUrl)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t(goal ? 'goals.editTitle' : 'goals.createTitle')}</DialogTitle>
          <DialogDescription>{t('goals.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <form
          id="goal-form"
          className="grid gap-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FormField
            id="goal-name"
            label={t('goals.fields.name')}
            placeholder={t('goals.placeholders.name')}
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            error={fieldError(nameMissing, 'projects.errors.required')}
            maxLength={80}
          />

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t('goals.fields.kind')}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(['click', 'pageview', 'event'] as const).map((kind) => {
                const Icon = GOAL_ICONS[kind];
                const selected = draft.kind === kind;
                return (
                  <label
                    key={kind}
                    className={cn(
                      'grid cursor-pointer gap-1 rounded-lg border p-3 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                      selected ? 'border-primary bg-primary/5' : 'hover:border-foreground/30',
                    )}
                  >
                    <input
                      type="radio"
                      name="goal-kind"
                      className="sr-only"
                      checked={selected}
                      onChange={() => set('kind', kind)}
                    />
                    <span className="flex items-center gap-2 font-medium">
                      <Icon className="size-4 text-primary" aria-hidden="true" />
                      {t(`goals.kinds.${kind}`)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(`goals.kindHints.${kind}`)}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {draft.kind === 'click' && (
            <div className="grid gap-2">
              <Label htmlFor="goal-selector">{t('elements.fields.selector')}</Label>
              <div className="flex gap-2">
                <Input
                  id="goal-selector"
                  className="font-mono text-sm"
                  placeholder="#signup-button"
                  spellCheck={false}
                  value={draft.selector}
                  onChange={(e) => set('selector', e.target.value)}
                  aria-invalid={submitted && (!draft.selector || selectorInvalid)}
                />
                <Button type="button" variant="outline" onClick={onPickOnPage}>
                  <MousePointerClick />
                  {t('goals.pick')}
                </Button>
              </div>
              {submitted && (!draft.selector || selectorInvalid) && (
                <p className="text-sm text-destructive">
                  {t(selectorInvalid ? 'elements.errors.selector' : 'projects.errors.required')}
                </p>
              )}
            </div>
          )}

          {draft.kind === 'pageview' && (
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <SelectField
                  id="goal-match"
                  label={t('goals.fields.match')}
                  value={draft.match}
                  onChange={(v) => set('match', v as Draft['match'])}
                  options={URL_MATCH_TYPES.map((m) => ({
                    value: m,
                    label: t(`goals.matches.${m}`),
                  }))}
                />
                <FormField
                  id="goal-value"
                  label={t('goals.fields.value')}
                  className="font-mono text-sm"
                  placeholder={
                    draft.match === 'regex' ? '/thanks\\?order=\\d+' : '/checkout/thanks'
                  }
                  value={draft.value}
                  onChange={(e) => set('value', e.target.value)}
                  error={fieldError(
                    !parsed.success,
                    draft.match === 'regex' ? 'goals.errors.regex' : 'projects.errors.required',
                  )}
                />
              </div>
              <div className="grid gap-2 rounded-lg bg-muted/50 p-3">
                <Label htmlFor="goal-test-url" className="text-xs">
                  {t('goals.test.label')}
                </Label>
                <Input
                  id="goal-test-url"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  className="bg-background font-mono text-xs"
                />
                {testResult !== null && (
                  <p
                    className={cn(
                      'flex items-center gap-1.5 text-sm',
                      testResult
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-muted-foreground',
                    )}
                    aria-live="polite"
                  >
                    {testResult ? <Check className="size-4" /> : <X className="size-4" />}
                    {t(testResult ? 'goals.test.match' : 'goals.test.noMatch')}
                  </p>
                )}
              </div>
            </div>
          )}

          {draft.kind === 'event' && (
            <div className="grid gap-3">
              <FormField
                id="goal-event"
                label={t('goals.fields.eventName')}
                className="font-mono text-sm"
                placeholder="sign_up"
                value={draft.eventName}
                onChange={(e) => set('eventName', e.target.value)}
                error={fieldError(!parsed.success, 'goals.errors.eventName')}
                hint={t('goals.hints.eventName')}
              />
              <CodeHint>
                {`window.dataLayer.push({ event: '${draft.eventName || 'sign_up'}' });\n// ${t('goals.hints.or')}\nwindow.uplift.track('${draft.eventName || 'sign_up'}');`}
              </CodeHint>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button type="submit" form="goal-form" disabled={mutation.isPending}>
            {t(goal ? 'common.save' : 'goals.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CodeHint({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}
