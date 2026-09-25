import { FlaskConical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useLogout, useMe } from '@/features/auth/api';

/** Reminds demo visitors that the account is temporary and offers a way out. */
export function DemoBanner() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!me?.user.isDemo) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b bg-primary/10 px-4 py-2 text-center text-sm">
      <FlaskConical className="size-4 text-primary" aria-hidden="true" />
      <span>{t('demoBanner.text')}</span>
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0"
        onClick={() =>
          logout.mutate(undefined, {
            onSettled: () => void navigate('/register', { replace: true }),
          })
        }
      >
        {t('demoBanner.cta')}
      </Button>
    </div>
  );
}
