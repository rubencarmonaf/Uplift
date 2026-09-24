import type { Project } from '@uplift/shared';
import { useOutletContext } from 'react-router';

/** The optimization workflow, in the order users go through it. */
export const PROJECT_STEPS = [
  'overview',
  'elements',
  'brief',
  'variants',
  'goals',
  'preview',
  'activation',
  'results',
] as const;
export type ProjectStep = (typeof PROJECT_STEPS)[number];

export function useProjectContext() {
  return useOutletContext<{ project: Project }>();
}
