import type { Brief, BriefResponse } from '@uplift/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectKeys } from '@/features/projects/api';
import { api } from '@/lib/api';

export const briefKeys = {
  detail: (projectId: string) => ['projects', 'detail', projectId, 'brief'] as const,
};

export function useBrief(projectId: string) {
  return useQuery({
    queryKey: briefKeys.detail(projectId),
    queryFn: () => api<BriefResponse>(`/projects/${projectId}/brief`),
  });
}

export function useSaveBrief(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (brief: Brief) =>
      api<BriefResponse>(`/projects/${projectId}/brief`, { method: 'PUT', json: brief }),
    onSuccess: (saved) => {
      qc.setQueryData(briefKeys.detail(projectId), saved);
      return Promise.all([
        qc.invalidateQueries({ queryKey: projectKeys.detail(projectId), exact: true }),
        qc.invalidateQueries({ queryKey: [...projectKeys.all, 'list'] }),
      ]);
    },
  });
}
