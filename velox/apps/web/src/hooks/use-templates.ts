import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { MetadataTemplate, CreateTemplateInput, UpdateTemplateInput, ApiResponse } from '@velox/shared';

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<ApiResponse<MetadataTemplate[]>>('/templates'),
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['template', id],
    queryFn: () => api.get<ApiResponse<MetadataTemplate>>(`/templates/${id}`),
    enabled: !!id,
  });
}

export function useMatchTemplate(fileName: string | undefined, folderId?: string) {
  return useQuery({
    queryKey: ['template-match', fileName, folderId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (fileName) params.set('fileName', fileName);
      if (folderId) params.set('folderId', folderId);
      return api.get<ApiResponse<MetadataTemplate | null>>(`/templates/match?${params}`);
    },
    enabled: !!fileName,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTemplateInput) =>
      api.post<ApiResponse<MetadataTemplate>>('/templates', input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); },
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateTemplateInput & { id: string }) =>
      api.patch<ApiResponse<MetadataTemplate>>(`/templates/${id}`, input),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      qc.invalidateQueries({ queryKey: ['template', v.id] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ApiResponse>(`/templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); },
  });
}
