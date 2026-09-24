import type { Snapshot, SnapshotError } from '@uplift/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';

export const snapshotKeys = {
  latest: (projectId: string) => ['projects', 'detail', projectId, 'snapshot'] as const,
};

export function useSnapshot(projectId: string, enabled = true) {
  return useQuery({
    queryKey: snapshotKeys.latest(projectId),
    queryFn: async () => {
      try {
        return await api<Snapshot>(`/projects/${projectId}/snapshot`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled,
  });
}

export function useCaptureSnapshot(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<Snapshot>(`/projects/${projectId}/snapshot`, { method: 'POST' }),
    onSuccess: (snapshot) => qc.setQueryData(snapshotKeys.latest(projectId), snapshot),
  });
}

/** The reason the API gave for a failed capture, if any. */
export function snapshotErrorReason(err: unknown): SnapshotError | 'rate_limited' | 'unknown' {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'rate_limited';
    const reason = (err.body as { reason?: SnapshotError } | undefined)?.reason;
    if (reason) return reason;
  }
  return 'unknown';
}

export const snapshotDocumentUrl = (snapshot: Snapshot) =>
  // The timestamp busts any cached copy when the snapshot is refreshed.
  `/api/snapshots/${snapshot.id}/document?v=${encodeURIComponent(snapshot.createdAt)}`;
