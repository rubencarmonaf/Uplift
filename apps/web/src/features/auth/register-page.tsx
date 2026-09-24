import { zodResolver } from '@hookform/resolvers/zod';
import { type RegisterInput, registerSchema } from '@uplift/shared';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useRegister } from './api';
import { AuthLayout } from './auth-layout';
import { authErrorMessage } from './error-message';
import { FormField } from './form-field';

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const register = useRegister();
  const form = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    register.mutate(values, {
      onSuccess: () => void navigate('/projects', { replace: true }),
    }),
  );

  return (
    <AuthLayout
      title={t('auth.register.title')}
      description={t('auth.register.description')}
      footer={
        <>
          {t('auth.register.hasAccount')}{' '}
          <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
            {t('auth.register.toLogin')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        {register.isError && (
          <Alert variant="destructive">
            <AlertDescription>{authErrorMessage(register.error, t)}</AlertDescription>
          </Alert>
        )}
        <FormField
          id="name"
          autoComplete="name"
          label={t('auth.name')}
          error={errors.name?.message}
          {...form.register('name')}
        />
        <FormField
          id="email"
          type="email"
          autoComplete="email"
          label={t('auth.email')}
          error={errors.email?.message}
          {...form.register('email')}
        />
        <FormField
          id="password"
          type="password"
          autoComplete="new-password"
          label={t('auth.password')}
          hint={t('auth.register.passwordHint')}
          error={errors.password?.message}
          {...form.register('password')}
        />
        <Button type="submit" className="w-full" disabled={register.isPending}>
          {t('auth.register.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
