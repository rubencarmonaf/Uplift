import { zodResolver } from '@hookform/resolvers/zod';
import {
  type CreateProjectInput,
  createProjectSchema,
  INDUSTRIES,
  PAGE_TYPES,
} from '@uplift/shared';
import type { ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/components/form-field';
import { SelectField } from '@/components/select-field';
import { localeLabel, MARKET_LOCALES } from './markets';

export function ProjectForm({
  id,
  defaultValues,
  onSubmit,
  disabled,
  footer,
}: {
  id: string;
  defaultValues?: Partial<CreateProjectInput>;
  onSubmit: (values: CreateProjectInput) => void;
  disabled?: boolean;
  footer?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { locale: i18n.resolvedLanguage === 'en' ? 'en-US' : 'es-ES', ...defaultValues },
  });
  const { errors } = form.formState;

  return (
    <form id={id} onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <FormField
        id={`${id}-name`}
        label={t('projects.fields.name')}
        placeholder={t('projects.placeholders.name')}
        error={errors.name && t('projects.errors.required')}
        disabled={disabled}
        {...form.register('name')}
      />
      <FormField
        id={`${id}-url`}
        type="url"
        inputMode="url"
        label={t('projects.fields.url')}
        placeholder="https://www.example.com/pricing"
        hint={t('projects.hints.url')}
        error={errors.url && t('projects.errors.url')}
        disabled={disabled}
        {...form.register('url')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={form.control}
          name="industry"
          render={({ field }) => (
            <SelectField
              id={`${id}-industry`}
              label={t('projects.fields.industry')}
              placeholder={t('projects.placeholders.select')}
              value={field.value}
              onChange={field.onChange}
              options={INDUSTRIES.map((v) => ({ value: v, label: t(`projects.industries.${v}`) }))}
              error={errors.industry && t('projects.errors.required')}
              disabled={disabled}
            />
          )}
        />
        <Controller
          control={form.control}
          name="pageType"
          render={({ field }) => (
            <SelectField
              id={`${id}-pageType`}
              label={t('projects.fields.pageType')}
              placeholder={t('projects.placeholders.select')}
              value={field.value}
              onChange={field.onChange}
              options={PAGE_TYPES.map((v) => ({ value: v, label: t(`projects.pageTypes.${v}`) }))}
              error={errors.pageType && t('projects.errors.required')}
              disabled={disabled}
            />
          )}
        />
      </div>
      <Controller
        control={form.control}
        name="locale"
        render={({ field }) => (
          <SelectField
            id={`${id}-locale`}
            label={t('projects.fields.locale')}
            value={field.value}
            onChange={field.onChange}
            options={MARKET_LOCALES.map((tag) => ({
              value: tag,
              label: localeLabel(tag, i18n.resolvedLanguage ?? 'en'),
            }))}
            error={errors.locale && t('projects.errors.required')}
            disabled={disabled}
          />
        )}
      />
      {footer}
    </form>
  );
}
