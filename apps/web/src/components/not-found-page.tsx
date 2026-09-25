import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <main className="grid min-h-svh place-items-center px-4 text-center">
      <div className="grid gap-4">
        <p className="text-5xl font-semibold text-primary">404</p>
        <h1 className="text-xl font-medium">{t('notFound.title')}</h1>
        <Button asChild variant="outline">
          <Link to="/">{t('notFound.back')}</Link>
        </Button>
      </div>
    </main>
  );
}
