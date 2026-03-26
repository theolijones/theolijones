import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { ModuleConfig, CreateModuleInput, ApiResponse } from '@velox/shared';

export function useModules() {
  return useQuery({
    queryKey: ['modules'],
    queryFn: () => api.get<ApiResponse<ModuleConfig[]> & { total: number }>('/modules'),
  });
}

export function useModule(id: string | undefined) {
  return useQuery({
    queryKey: ['module', id],
    queryFn: () => api.get<ApiResponse<ModuleConfig>>(`/modules/${id}`),
    enabled: !!id,
  });
}

export function useModuleEmbed(id: string | undefined) {
  return useQuery({
    queryKey: ['module-embed', id],
    queryFn: () => api.get<ApiResponse<{
      id: string;
      html: string;
      iframeUrl: string;
      scriptTag: string;
      config: Record<string, unknown>;
    }>>(`/modules/${id}/embed`),
    enabled: !!id,
  });
}

export function useCreateModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateModuleInput) => api.post<ApiResponse<ModuleConfig>>('/modules', input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['modules'] }); },
  });
}

export function useUpdateModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<ModuleConfig> & { id: string }) =>
      api.patch<ApiResponse<ModuleConfig>>(`/modules/${id}`, input),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['modules'] });
      qc.invalidateQueries({ queryKey: ['module', v.id] });
      qc.invalidateQueries({ queryKey: ['module-embed', v.id] });
    },
  });
}

export function useDeleteModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ApiResponse>(`/modules/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['modules'] }); },
  });
}
