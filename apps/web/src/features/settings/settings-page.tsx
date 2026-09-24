import { zodResolver } from '@hookform/resolvers/zod';
import {
  type ChangePasswordInput,
  changePasswordSchema,
  updateOrganizationSchema,
  updateProfileSchema,
} from '@uplift/shared';
import { Bot, FlaskConical, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { z } from 'zod';
import { FormField } from '@/components/form-field';
import { PageHeader } from '@/components/page-header';
import { SelectField } from '@/components/select-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/api';
import { useCurrentOrg } from '@/features/organizations/use-current-org';
import { useAiStatus } from '@/features/variants/api';
import { ApiError } from '@/lib/api';
import { LOCALES, setLocale } from '@/lib/i18n';
import { useChangePassword, useMembers, useRenameOrganization, useUpdateProfile } from './api';

const LOCALE_NAMES = { es: 'Español', en: 'English' } as const;

export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.description')} />
      <div className="grid max-w-3xl gap-6">
        <ProfileCard />
        <PasswordCard />
        <OrganizationCard />
        <AiCard />
      </div>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ProfileCard() {
  const { t, i18n } = useTranslation();
  const { data: me } = useMe();
  const update = useUpdateProfile();
  const form = useForm<z.input<typeof updateProfileSchema>>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: me?.user.name ?? '', locale: me?.user.locale ?? 'es' },
  });
  const locale = useWatch({ control: form.control, name: 'locale' });

  return (
    <Section title={t('settings.profile.title')} description={t('settings.profile.description')}>
      <form
        className="grid gap-4"
        noValidate
        onSubmit={form.handleSubmit((values) =>
          update.mutate(values, {
            onSuccess: (updated) => {
              form.reset({ name: updated.user.name, locale: updated.user.locale });
              setLocale(updated.user.locale);
              // i18n.t follows the language just applied; the hook's t is still the old one.
              toast.success(i18n.t('settings.toasts.saved'));
            },
            onError: () => toast.error(t('common.errors.generic')),
          }),
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="profile-name"
            label={t('auth.name')}
            autoComplete="name"
            error={form.formState.errors.name && t('projects.errors.required')}
            {...form.register('name')}
          />
          <SelectField
            id="profile-locale"
            label={t('user.language')}
            value={locale}
            onChange={(v) => form.setValue('locale', v as 'es' | 'en', { shouldDirty: true })}
            options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))}
          />
        </div>
        <FormField
          id="profile-email"
          label={t('auth.email')}
          value={me?.user.email ?? ''}
          readOnly
          disabled
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={!form.formState.isDirty || update.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function PasswordCard() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const change = useChangePassword();
  const form = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });
  const { errors } = form.formState;
  const isDemo = !!me?.user.isDemo;

  return (
    <Section title={t('settings.password.title')} description={t('settings.password.description')}>
      {isDemo ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <FlaskConical className="size-4" aria-hidden="true" />
          {t('settings.password.demo')}
        </p>
      ) : (
        <form
          className="grid gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={form.handleSubmit((values) =>
            change.mutate(values, {
              onSuccess: () => {
                form.reset({ currentPassword: '', newPassword: '' });
                toast.success(t('settings.toasts.passwordChanged'));
              },
              onError: (err) =>
                err instanceof ApiError &&
                (err.body as { reason?: string }).reason === 'wrong_password'
                  ? form.setError('currentPassword', { message: t('settings.password.wrong') })
                  : toast.error(t('common.errors.generic')),
            }),
          )}
        >
          <FormField
            id="current-password"
            type="password"
            autoComplete="current-password"
            label={t('settings.password.current')}
            error={
              errors.currentPassword &&
              (errors.currentPassword.message || t('projects.errors.required'))
            }
            {...form.register('currentPassword')}
          />
          <FormField
            id="new-password"
            type="password"
            autoComplete="new-password"
            label={t('settings.password.new')}
            hint={t('auth.register.passwordHint')}
            error={errors.newPassword?.message}
            {...form.register('newPassword')}
          />
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={change.isPending}>
              {t('settings.password.submit')}
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}

function OrganizationCard() {
  const { t } = useTranslation();
  const org = useCurrentOrg();
  const rename = useRenameOrganization(org.id);
  const members = useMembers(org.id);
  const isAdmin = org.role === 'admin';
  const form = useForm<z.input<typeof updateOrganizationSchema>>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: { name: org.name },
  });

  return (
    <Section
      title={t('settings.organization.title')}
      description={t('settings.organization.description')}
    >
      <div className="grid gap-6">
        <form
          className="flex flex-wrap items-end gap-3"
          noValidate
          onSubmit={form.handleSubmit((values) =>
            rename.mutate(values, {
              onSuccess: (updated) => {
                form.reset({ name: updated.name });
                toast.success(t('settings.toasts.saved'));
              },
              onError: () => toast.error(t('common.errors.generic')),
            }),
          )}
        >
          <div className="min-w-56 flex-1">
            <FormField
              id="org-name"
              label={t('settings.organization.name')}
              disabled={!isAdmin}
              error={form.formState.errors.name && t('projects.errors.required')}
              {...form.register('name')}
            />
          </div>
          {isAdmin && (
            <Button type="submit" disabled={!form.formState.isDirty || rename.isPending}>
              {t('common.save')}
            </Button>
          )}
        </form>

        <div className="grid gap-2">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Users className="size-4" aria-hidden="true" />
            {t('settings.organization.members')}
          </h3>
          {members.isPending ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <ul className="divide-y rounded-lg border">
              {(members.data ?? []).map((member) => (
                <li
                  key={member.userId}
                  className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm"
                >
                  <div className="grid min-w-0 flex-1">
                    <span className="font-medium">
                      {member.name}
                      {member.isYou && (
                        <span className="text-muted-foreground">
                          {' '}
                          ({t('settings.organization.you')})
                        </span>
                      )}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{member.email}</span>
                  </div>
                  <Badge variant="secondary">{t(`settings.roles.${member.role}`)}</Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">{t('settings.organization.invitesSoon')}</p>
        </div>
      </div>
    </Section>
  );
}

function AiCard() {
  const { t } = useTranslation();
  const status = useAiStatus();
  const demo = status.data?.provider === 'mock';
  return (
    <Section title={t('settings.ai.title')} description={t('settings.ai.description')}>
      <p className="flex items-start gap-2 text-sm">
        {demo ? (
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <Bot className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        )}
        <span>
          {status.isPending
            ? t('picker.loading')
            : demo
              ? t('settings.ai.mock')
              : t('settings.ai.claude', { model: status.data?.model })}
        </span>
      </p>
    </Section>
  );
}
