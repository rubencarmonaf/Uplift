import type { LibraryItem, LibraryQuery } from '@uplift/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const libraryKeys = {
  all: ['library'] as const,
  list: (orgId: string, query: LibraryQuery) => ['library', orgId, query] as const,
};

export function useLibrary(orgId: string, query: LibraryQuery) {
  const params = new URLSearchParams(
    Object.entries(query).filter(
      (e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '',
    ),
  );
  return useQuery({
    queryKey: libraryKeys.list(orgId, query),
    queryFn: () => api<LibraryItem[]>(`/organizations/${orgId}/library?${params}`),
    placeholderData: keepPreviousData,
  });
}
