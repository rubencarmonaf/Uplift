import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from './api';

function FullPageSpinner() {
  return (
    <div className="grid min-h-svh place-items-center" role="status" aria-live="polite">
      <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
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
