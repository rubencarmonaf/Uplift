import type {
  GenerateVariantsInput,
  GenerationJob,
  UpdateVariantInput,
  Variant,
} from '@uplift/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { projectKeys } from '@/features/projects/api';
import { api, ApiError } from '@/lib/api';

export const variantKeys = {
  list: (projectId: string) => ['projects', 'detail', projectId, 'variants'] as const,
  latestJob: (projectId: string) => ['projects', 'detail', projectId, 'generation'] as const,
  aiStatus: ['ai', 'status'] as const,
};

const isActive = (job: GenerationJob | null | undefined) =>
  job?.status === 'queued' || job?.status === 'running';

export function useAiStatus() {
  return useQuery({
    queryKey: variantKeys.aiStatus,
    queryFn: () => api<{ provider: 'anthropic' | 'mock'; model: string | null }>('/ai/status'),
    staleTime: Infinity,
  });
}

/** The project's latest generation job; polled every second while it runs. */
export function useLatestGeneration(projectId: string) {
  return useQuery({
    queryKey: variantKeys.latestJob(projectId),
    queryFn: async () => {
      try {
        return await api<GenerationJob>(`/projects/${projectId}/generations/latest`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    refetchInterval: (query) => (isActive(query.state.data) ? 1000 : false),
    // Keep polling in a background tab, so the result is there when the user comes back.
    refetchIntervalInBackground: true,
  });
}

/** Variants refresh on each job poll, so new ones appear as each element finishes. */
export function useVariants(projectId: string, job: GenerationJob | null | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: variantKeys.list(projectId),
    queryFn: () => api<Variant[]>(`/projects/${projectId}/variants`),
  });

  const progress = job ? `${job.id}:${job.status}:${job.completedElements}` : null;
  const lastProgress = useRef(progress);
  useEffect(() => {
    if (progress === lastProgress.current) return;
    lastProgress.current = progress;
    void qc.invalidateQueries({ queryKey: variantKeys.list(projectId) });
    if (job && !isActive(job)) {
      void qc.invalidateQueries({ queryKey: projectKeys.detail(projectId), exact: true });
    }
  }, [progress, job, projectId, qc]);

  return query;
}

export function useGenerateVariants(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateVariantsInput) =>
      api<GenerationJob>(`/projects/${projectId}/generations`, { method: 'POST', json: input }),
    onSuccess: (job) => qc.setQueryData(variantKeys.latestJob(projectId), job),
  });
}

export function useCreateVariant(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ elementId, text }: { elementId: string; text: string }) =>
      api<Variant>(`/elements/${elementId}/variants`, { method: 'POST', json: { text } }),
    onSuccess: (variant) =>
      qc.setQueryData<Variant[]>(variantKeys.list(projectId), (old) => [variant, ...(old ?? [])]),
  });
}

/** Optimistic, so discarding and restoring feel instant. */
export function useUpdateVariant(projectId: string) {
  const qc = useQueryClient();
  const key = variantKeys.list(projectId);
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateVariantInput & { id: string }) =>
      api<Variant>(`/variants/${id}`, { method: 'PATCH', json: input }),
    onMutate: async ({ id, ...input }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Variant[]>(key);
      qc.setQueryData<Variant[]>(key, (old) =>
        old?.map((v) => (v.id === id ? { ...v, ...input } : v)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => qc.setQueryData(key, context?.previous),
    onSuccess: (variant) =>
      qc.setQueryData<Variant[]>(key, (old) =>
        old?.map((v) => (v.id === variant.id ? variant : v)),
      ),
  });
}
