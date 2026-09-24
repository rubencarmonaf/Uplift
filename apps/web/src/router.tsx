import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from '@/components/layout/app-shell';
import { NotFoundPage } from '@/components/not-found-page';
import { PlaceholderPage } from '@/components/placeholder-page';
import { RedirectIfAuthed, RequireAuth } from '@/features/auth/guards';
import { LoginPage } from '@/features/auth/login-page';
import { RegisterPage } from '@/features/auth/register-page';
import { ProjectsPage } from '@/features/projects/projects-page';

export const router = createBrowserRouter([
  {
    element: <RedirectIfAuthed />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/projects" replace /> },
          { path: '/projects', element: <ProjectsPage /> },
          { path: '/library', element: <PlaceholderPage titleKey="nav.library" /> },
          { path: '/settings', element: <PlaceholderPage titleKey="nav.settings" /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
