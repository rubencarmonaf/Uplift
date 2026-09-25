import type { CreateElementInput, PageElement, UpdateElementInput } from '@uplift/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectKeys } from '@/features/projects/api';
import { api } from '@/lib/api';

export const elementKeys = {
  list: (projectId: string) => ['projects', 'detail', projectId, 'elements'] as const,
};

export function useElements(projectId: string) {
  return useQuery({
    queryKey: elementKeys.list(projectId),
    queryFn: () => api<PageElement[]>(`/projects/${projectId}/elements`),
    enabled: projectId !== '',
  });
}

/** Element changes bump the project's "last modified", so the project caches go stale too. */
function useInvalidate(projectId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: elementKeys.list(projectId) }),
      qc.invalidateQueries({ queryKey: projectKeys.detail(projectId), exact: true }),
      qc.invalidateQueries({ queryKey: [...projectKeys.all, 'list'] }),
    ]);
}

export function useCreateElement(projectId: string) {
  const invalidate = useInvalidate(projectId);
  return useMutation({
    mutationFn: (input: CreateElementInput) =>
      api<PageElement>(`/projects/${projectId}/elements`, { method: 'POST', json: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateElement(projectId: string) {
  const invalidate = useInvalidate(projectId);
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateElementInput & { id: string }) =>
      api<PageElement>(`/elements/${id}`, { method: 'PATCH', json: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteElement(projectId: string) {
  const invalidate = useInvalidate(projectId);
  return useMutation({
    mutationFn: (id: string) => api<void>(`/elements/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

/** Reorders optimistically so moving an element feels instant; rolls back if the API refuses. */
export function useReorderElements(projectId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidate(projectId);
  const key = elementKeys.list(projectId);
  return useMutation({
    mutationFn: (ids: string[]) =>
      api<PageElement[]>(`/projects/${projectId}/elements/order`, { method: 'PUT', json: { ids } }),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PageElement[]>(key);
      if (previous) {
        const byId = new Map(previous.map((e) => [e.id, e]));
        qc.setQueryData(
          key,
          ids.flatMap((id, position) => {
            const element = byId.get(id);
            return element ? [{ ...element, position }] : [];
          }),
        );
      }
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
    },
    onSettled: invalidate,
  });
}
