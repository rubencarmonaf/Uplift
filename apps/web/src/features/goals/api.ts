import type { CreateGoalInput, Goal, UpdateGoalInput } from '@uplift/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectKeys } from '@/features/projects/api';
import { api } from '@/lib/api';

export const goalKeys = {
  list: (projectId: string) => ['projects', 'detail', projectId, 'goals'] as const,
};

export function useGoals(projectId: string) {
  return useQuery({
    queryKey: goalKeys.list(projectId),
    queryFn: () => api<Goal[]>(`/projects/${projectId}/goals`),
  });
}

/** Changing one goal can change another's primary flag, so the whole list is refetched. */
function useInvalidate(projectId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: goalKeys.list(projectId) }),
      qc.invalidateQueries({ queryKey: projectKeys.detail(projectId), exact: true }),
    ]);
}

export function useCreateGoal(projectId: string) {
  const onSuccess = useInvalidate(projectId);
  return useMutation({
    mutationFn: (input: CreateGoalInput) =>
      api<Goal>(`/projects/${projectId}/goals`, { method: 'POST', json: input }),
    onSuccess,
  });
}

export function useUpdateGoal(projectId: string) {
  const onSuccess = useInvalidate(projectId);
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateGoalInput & { id: string }) =>
      api<Goal>(`/goals/${id}`, { method: 'PATCH', json: input }),
    onSuccess,
  });
}

export function useDeleteGoal(projectId: string) {
  const onSuccess = useInvalidate(projectId);
  return useMutation({
    mutationFn: (id: string) => api<void>(`/goals/${id}`, { method: 'DELETE' }),
    onSuccess,
  });
}
