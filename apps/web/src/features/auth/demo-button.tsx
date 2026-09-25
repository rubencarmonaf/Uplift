import { Loader2, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useStartDemo } from './api';

/** "Try the demo": signs in to a fresh example account, no sign-up needed. */
export function DemoButton() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const demo = useStartDemo();

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t('auth.demo.or')}
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={demo.isPending}
        onClick={() =>
          demo.mutate(i18n.resolvedLanguage === 'en' ? 'en' : 'es', {
            onSuccess: () => void navigate('/projects', { replace: true }),
          })
        }
      >
        {demo.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {t(demo.isPending ? 'auth.demo.preparing' : 'auth.demo.cta')}
      </Button>
      <p
        className="text-center text-xs text-muted-foreground"
        role={demo.isError ? 'alert' : undefined}
      >
        {demo.isError
          ? t(
              demo.error instanceof ApiError && demo.error.status === 429
                ? 'auth.errors.tooManyAttempts'
                : 'auth.errors.generic',
            )
          : t('auth.demo.hint')}
      </p>
    </div>
  );
}
