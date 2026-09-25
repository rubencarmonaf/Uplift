import type { LoginInput, MeResponse, RegisterInput } from '@uplift/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';

export const meQueryKey = ['auth', 'me'] as const;

export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async () => {
      try {
        return await api<MeResponse>('/session');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    // A free-tier API sleeps when idle and can take about a minute to wake: keep trying on
    // network and 5xx errors; real answers (401 is handled above) are final.
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 30,
    retryDelay: 3000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api<MeResponse>('/session', { method: 'POST', json: input }),
    onSuccess: (me) => qc.setQueryData(meQueryKey, me),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api<MeResponse>('/accounts', { method: 'POST', json: input }),
    onSuccess: (me) => qc.setQueryData(meQueryKey, me),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/session', { method: 'DELETE' }),
    onSettled: () => {
      qc.clear();
      qc.setQueryData(meQueryKey, null);
    },
  });
}

/** Creates a throwaway demo account with example data and signs in to it. */
export function useStartDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (language: 'es' | 'en') =>
      api<MeResponse>('/demo-accounts', { method: 'POST', json: { language } }),
    onSuccess: (me) => {
      qc.clear();
      qc.setQueryData(meQueryKey, me);
    },
  });
}
