import type {
  CreateProjectInput,
  CopyProjectInput,
  ListProjectsQuery,
  Project,
  UpdateProjectInput,
} from '@uplift/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const projectKeys = {
  all: ['projects'] as const,
  list: (orgId: string, query: ListProjectsQuery) => ['projects', 'list', orgId, query] as const,
  detail: (id: string) => ['projects', 'detail', id] as const,
};

function toSearchParams(query: ListProjectsQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

export function useProjects(orgId: string, query: ListProjectsQuery) {
  return useQuery({
    queryKey: projectKeys.list(orgId, query),
    queryFn: () => api<Project[]>(`/organizations/${orgId}/projects?${toSearchParams(query)}`),
    placeholderData: keepPreviousData,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => api<Project>(`/projects/${id}`),
  });
}

function useInvalidateOnSuccess() {
  const qc = useQueryClient();
  return (project?: Project) => {
    if (project) qc.setQueryData(projectKeys.detail(project.id), project);
    return qc.invalidateQueries({ queryKey: [...projectKeys.all, 'list'] });
  };
}

export function useCreateProject(orgId: string) {
  const onSuccess = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      api<Project>(`/organizations/${orgId}/projects`, { method: 'POST', json: input }),
    onSuccess,
  });
}

export function useUpdateProject() {
  const onSuccess = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateProjectInput & { id: string }) =>
      api<Project>(`/projects/${id}`, { method: 'PATCH', json: input }),
    onSuccess,
  });
}

export function useCopyProject() {
  const onSuccess = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: ({ id, ...input }: CopyProjectInput & { id: string }) =>
      api<Project>(`/projects/${id}/copies`, { method: 'POST', json: input }),
    onSuccess,
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: projectKeys.detail(id) });
      return qc.invalidateQueries({ queryKey: [...projectKeys.all, 'list'] });
    },
  });
}
