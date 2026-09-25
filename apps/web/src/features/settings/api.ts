import type {
  ChangePasswordInput,
  MeResponse,
  Member,
  UpdateOrganizationInput,
  UpdateProfileInput,
} from '@uplift/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meQueryKey } from '@/features/auth/api';
import { api } from '@/lib/api';

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      api<MeResponse>('/account', { method: 'PATCH', json: input }),
    onSuccess: (me) => qc.setQueryData(meQueryKey, me),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      api<void>('/account/password', { method: 'PUT', json: input }),
  });
}

export function useRenameOrganization(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateOrganizationInput) =>
      api<{ id: string; name: string }>(`/organizations/${orgId}`, {
        method: 'PATCH',
        json: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: meQueryKey }),
  });
}

export function useMembers(orgId: string) {
  return useQuery({
    queryKey: ['organizations', orgId, 'members'],
    queryFn: () => api<Member[]>(`/organizations/${orgId}/members`),
  });
}
