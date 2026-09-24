import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, loginSchema } from '@uplift/shared';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useLogin } from './api';
import { AuthLayout } from './auth-layout';
import { authErrorMessage } from './error-message';
import { FormField } from './form-field';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: () => {
        const from = (location.state as { from?: Location } | null)?.from?.pathname;
        void navigate(from ?? '/projects', { replace: true });
      },
    }),
  );

  return (
    <AuthLayout
      title={t('auth.login.title')}
      description={t('auth.login.description')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" className="font-medium text-foreground underline underline-offset-4">
            {t('auth.login.toRegister')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        {login.isError && (
          <Alert variant="destructive">
            <AlertDescription>{authErrorMessage(login.error, t)}</AlertDescription>
          </Alert>
        )}
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
          autoComplete="current-password"
          label={t('auth.password')}
          error={errors.password?.message}
          {...form.register('password')}
        />
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {t('auth.login.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
