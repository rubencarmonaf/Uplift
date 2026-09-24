import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from '@/components/layout/app-shell';
import { NotFoundPage } from '@/components/not-found-page';
import { PlaceholderPage } from '@/components/placeholder-page';
import { ActivationPage } from '@/features/activation/activation-page';
import { RedirectIfAuthed, RequireAuth } from '@/features/auth/guards';
import { BriefPage } from '@/features/brief/brief-page';
import { ElementsPage } from '@/features/elements/elements-page';
import { GoalsPage } from '@/features/goals/goals-page';
import { PreviewPage } from '@/features/preview/preview-page';
import { LoginPage } from '@/features/auth/login-page';
import { RegisterPage } from '@/features/auth/register-page';
import { ProjectOverviewPage } from '@/features/projects/project-overview-page';
import { ProjectShell } from '@/features/projects/project-shell';
import { PROJECT_STEPS, type ProjectStep } from '@/features/projects/project-steps';
import { ProjectStepPlaceholder } from '@/features/projects/project-step-placeholder';
import { ProjectsPage } from '@/features/projects/projects-page';
import { ResultsPage } from '@/features/results/results-page';
import { VariantsPage } from '@/features/variants/variants-page';

/** Steps that are built; the rest show a placeholder. */
const STEP_PAGES: Partial<Record<ProjectStep, React.ReactNode>> = {
  elements: <ElementsPage />,
  brief: <BriefPage />,
  variants: <VariantsPage />,
  goals: <GoalsPage />,
  preview: <PreviewPage />,
  activation: <ActivationPage />,
  results: <ResultsPage />,
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
              ...PROJECT_STEPS.filter((step) => step !== 'overview').map((step) => ({
                path: step,
                element: STEP_PAGES[step] ?? <ProjectStepPlaceholder step={step} />,
              })),
            ],
          },
          { path: '/library', element: <PlaceholderPage titleKey="nav.library" /> },
          { path: '/settings', element: <PlaceholderPage titleKey="nav.settings" /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
