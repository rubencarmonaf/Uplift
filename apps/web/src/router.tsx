import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from '@/components/layout/app-shell';
import { NotFoundPage } from '@/components/not-found-page';
import { PlaceholderPage } from '@/components/placeholder-page';
import { RedirectIfAuthed, RequireAuth } from '@/features/auth/guards';
import { LoginPage } from '@/features/auth/login-page';
import { RegisterPage } from '@/features/auth/register-page';
import { ProjectOverviewPage } from '@/features/projects/project-overview-page';
import { ProjectShell } from '@/features/projects/project-shell';
import { PROJECT_STEPS, type ProjectStep } from '@/features/projects/project-steps';
import { ProjectStepPlaceholder } from '@/features/projects/project-step-placeholder';
import { ProjectsPage } from '@/features/projects/projects-page';

type StepLoader = () => Promise<ComponentType>;

/**
 * Step pages are loaded on demand, so heavy dependencies (charts, the picker) are only
 * downloaded when a step is opened. Steps not listed show a placeholder.
 */
const STEP_PAGES: Partial<Record<ProjectStep, StepLoader>> = {
  elements: () => import('@/features/elements/elements-page').then((m) => m.ElementsPage),
  brief: () => import('@/features/brief/brief-page').then((m) => m.BriefPage),
  variants: () => import('@/features/variants/variants-page').then((m) => m.VariantsPage),
  goals: () => import('@/features/goals/goals-page').then((m) => m.GoalsPage),
  preview: () => import('@/features/preview/preview-page').then((m) => m.PreviewPage),
  activation: () => import('@/features/activation/activation-page').then((m) => m.ActivationPage),
  results: () => import('@/features/results/results-page').then((m) => m.ResultsPage),
};

const stepRoute = (step: Exclude<ProjectStep, 'overview'>) => {
  const load = STEP_PAGES[step];
  return load
    ? { path: step, lazy: async () => ({ Component: await load() }) }
    : { path: step, element: <ProjectStepPlaceholder step={step} /> };
};

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
          {
            path: '/projects/:projectId',
            element: <ProjectShell />,
            children: [
              { index: true, element: <ProjectOverviewPage /> },
              ...PROJECT_STEPS.filter((step) => step !== 'overview').map(stepRoute),
            ],
          },
          {
            path: '/library',
            lazy: async () => ({
              Component: (await import('@/features/library/library-page')).LibraryPage,
            }),
          },
          { path: '/settings', element: <PlaceholderPage titleKey="nav.settings" /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
