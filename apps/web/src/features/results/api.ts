import type { ExperimentResults, SimulateTrafficInput } from '@uplift/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { experimentKeys } from '@/features/activation/api';
import { api, ApiError } from '@/lib/api';

export const resultsKeys = {
  detail: (projectId: string) => ['projects', 'detail', projectId, 'results'] as const,
};

export function useResults(projectId: string) {
  return useQuery({
    queryKey: resultsKeys.detail(projectId),
    queryFn: async () => {
      try {
        return await api<ExperimentResults>(`/projects/${projectId}/results`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    // Live experiments keep collecting data; refresh while the page is open.
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 15_000 : false),
  });
}

export function useSimulateTraffic(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SimulateTrafficInput) =>
      api<ExperimentResults>(`/projects/${projectId}/results/simulation`, {
        method: 'POST',
        json: input,
      }),
    onSuccess: (results) => {
      qc.setQueryData(resultsKeys.detail(projectId), results);
      return qc.invalidateQueries({ queryKey: experimentKeys.detail(projectId) });
    },
  });
}

export function useClearSimulation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/projects/${projectId}/results/simulation`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: resultsKeys.detail(projectId) }),
  });
}
