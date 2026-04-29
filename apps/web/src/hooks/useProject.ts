import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '../api/projectApi';

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => projectApi.get(id!),
    enabled: !!id,
    refetchInterval: (q) =>
      q.state.data?.status === 'processing' ? 2000 : false,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.list(),
    refetchInterval: 30_000,
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof projectApi.update>[1] }) =>
      projectApi.update(id, updates),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.setQueryData(['project', data.id], data);
    },
  });
}