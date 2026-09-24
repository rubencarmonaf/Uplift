import type { Experiment, ExperimentAction, UpdateExperimentInput } from '@uplift/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectKeys } from '@/features/projects/api';
import { api } from '@/lib/api';

export const experimentKeys = {
  detail: (projectId: string) => ['projects', 'detail', projectId, 'experiment'] as const,
};

export function useExperiment(projectId: string) {
  return useQuery({
    queryKey: experimentKeys.detail(projectId),
    queryFn: () => api<Experiment>(`/projects/${projectId}/experiment`),
  });
}

export function useUpdateExperiment(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateExperimentInput) =>
      api<Experiment>(`/projects/${projectId}/experiment`, { method: 'PATCH', json: input }),
    onSuccess: (experiment) => qc.setQueryData(experimentKeys.detail(projectId), experiment),
  });
}

/** Lifecycle actions also change the project's status, so the project caches are refreshed. */
export function useExperimentAction(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ExperimentAction) =>
      api<Experiment>(`/projects/${projectId}/experiment/actions`, { method: 'POST', json: input }),
    onSuccess: (experiment) => {
      qc.setQueryData(experimentKeys.detail(projectId), experiment);
      return Promise.all([
        qc.invalidateQueries({ queryKey: projectKeys.detail(projectId), exact: true }),
        qc.invalidateQueries({ queryKey: [...projectKeys.all, 'list'] }),
        qc.invalidateQueries({ queryKey: ['projects', 'detail', projectId, 'results'] }),
      ]);
    },
  });
}
