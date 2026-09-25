import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from './api';

const SLOW_START_MS = 2500;

function FullPageSpinner() {
  const { t } = useTranslation();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_START_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      className="grid min-h-svh place-content-center justify-items-center gap-4 p-4 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
      {slow && (
        <div className="grid max-w-sm gap-1">
          <p className="font-medium">{t('boot.waking.title')}</p>
          <p className="text-sm text-muted-foreground">{t('boot.waking.body')}</p>
        </div>
      )}
    </div>
  );
}

/** Renders child routes only for signed-in users; otherwise sends them to login and back. */
export function RequireAuth() {
  const { data: me, isPending } = useMe();
  const location = useLocation();
  if (isPending) return <FullPageSpinner />;
  if (!me) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** Keeps signed-in users away from the login and register screens. */
export function RedirectIfAuthed() {
  const { data: me, isPending } = useMe();
  if (isPending) return <FullPageSpinner />;
  if (me) return <Navigate to="/projects" replace />;
  return <Outlet />;
}
