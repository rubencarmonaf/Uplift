import { zodResolver } from '@hookform/resolvers/zod';
import {
  createElementSchema,
  ELEMENT_TYPES,
  type ElementType,
  SUGGESTED_MAX_LENGTH,
} from '@uplift/shared';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { FormField } from '@/components/form-field';
import { SelectField } from '@/components/select-field';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { isValidSelector } from './selector';

type FormInput = z.input<typeof createElementSchema>;
export type ElementFormValues = z.output<typeof createElementSchema>;

// The browser also checks the selector syntax, which the API cannot do without a DOM.
const formSchema = createElementSchema.refine((v) => isValidSelector(v.selector), {
  message: 'invalid selector',
  path: ['selector'],
});

const toNullableNumber = (value: unknown) =>
  value === '' || value === null || value === undefined ? null : Number(value);

export function ElementForm({
  id,
  defaultValues,
  onSubmit,
  disabled,
}: {
  id: string;
  defaultValues?: Partial<FormInput>;
  onSubmit: (values: ElementFormValues) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const form = useForm<FormInput, unknown, ElementFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { notes: '', minLength: null, maxLength: null, ...defaultValues },
  });
  const { errors } = form.formState;
  const text = useWatch({ control: form.control, name: 'originalText' }) ?? '';
  const maxLength = useWatch({ control: form.control, name: 'maxLength' });
  const overLimit = maxLength != null && text.length > maxLength;

  const onTypeChange = (type: ElementType) => {
    form.setValue('type', type, { shouldValidate: form.formState.isSubmitted });
    // Suggest a length ceiling for the type, without overriding one the user already set.
    if (form.getValues('maxLength') == null && SUGGESTED_MAX_LENGTH[type]) {
      form.setValue('maxLength', SUGGESTED_MAX_LENGTH[type]);
    }
  };

  return (
    <form id={id} onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id={`${id}-name`}
          label={t('elements.fields.name')}
          placeholder={t('elements.placeholders.name')}
          error={errors.name && t('projects.errors.required')}
          disabled={disabled}
          {...form.register('name')}
        />
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <SelectField
              id={`${id}-type`}
              label={t('elements.fields.type')}
              placeholder={t('projects.placeholders.select')}
              value={field.value}
              onChange={(v) => onTypeChange(v as ElementType)}
              options={ELEMENT_TYPES.map((v) => ({ value: v, label: t(`elements.types.${v}`) }))}
              error={errors.type && t('projects.errors.required')}
              disabled={disabled}
            />
          )}
        />
      </div>

      <FormField
        id={`${id}-selector`}
        label={t('elements.fields.selector')}
        placeholder="#hero h1"
        hint={t('elements.hints.selector')}
        error={errors.selector && t('elements.errors.selector')}
        className="font-mono text-sm"
        spellCheck={false}
        autoComplete="off"
        disabled={disabled}
        {...form.register('selector')}
      />

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={`${id}-text`}>{t('elements.fields.originalText')}</Label>
          <span
            className={cn(
              'text-xs text-muted-foreground tabular-nums',
              overLimit && 'text-amber-600 dark:text-amber-400',
            )}
            aria-live="polite"
          >
            {t('elements.charCount', { count: text.length })}
          </span>
        </div>
        <Textarea
          id={`${id}-text`}
          rows={3}
          placeholder={t('elements.placeholders.originalText')}
          aria-invalid={!!errors.originalText}
          aria-describedby={errors.originalText ? `${id}-text-error` : `${id}-text-hint`}
          disabled={disabled}
          {...form.register('originalText')}
        />
        {errors.originalText ? (
          <p id={`${id}-text-error`} className="text-sm text-destructive">
            {t('projects.errors.required')}
          </p>
        ) : (
          <p id={`${id}-text-hint`} className="text-sm text-muted-foreground">
            {overLimit ? t('elements.hints.overLimit') : t('elements.hints.originalText')}
          </p>
        )}
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t('elements.fields.length')}</legend>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id={`${id}-min`}
            type="number"
            inputMode="numeric"
            min={1}
            label={t('elements.fields.minLength')}
            placeholder="—"
            disabled={disabled}
            error={errors.minLength && t('elements.errors.length')}
            {...form.register('minLength', { setValueAs: toNullableNumber })}
          />
          <FormField
            id={`${id}-max`}
            type="number"
            inputMode="numeric"
            min={1}
            label={t('elements.fields.maxLength')}
            placeholder="—"
            disabled={disabled}
            error={
              errors.maxLength &&
              t(
                errors.maxLength.message === 'min > max'
                  ? 'elements.errors.range'
                  : 'elements.errors.length',
              )
            }
            {...form.register('maxLength', { setValueAs: toNullableNumber })}
          />
        </div>
        <p className="text-sm text-muted-foreground">{t('elements.hints.length')}</p>
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor={`${id}-notes`}>{t('elements.fields.notes')}</Label>
        <Textarea
          id={`${id}-notes`}
          rows={2}
          placeholder={t('elements.placeholders.notes')}
          disabled={disabled}
          {...form.register('notes')}
        />
      </div>
    </form>
  );
}
