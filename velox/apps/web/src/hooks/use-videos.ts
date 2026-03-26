import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Video, ApiResponse, PaginatedResponse, CreateVideoInput, UpdateVideoInput } from '@velox/shared';

export function useVideos(params?: { folderId?: string; status?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.folderId) query.set('folderId', params.folderId);
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();

  return useQuery({
    queryKey: ['videos', params],
    queryFn: () => api.get<{ success: boolean } & PaginatedResponse<Video>>(`/videos${qs ? `?${qs}` : ''}`),
  });
}

export function useVideo(id: string | undefined) {
  return useQuery({
    queryKey: ['video', id],
    queryFn: () => api.get<ApiResponse<Video>>(`/videos/${id}`),
    enabled: !!id,
  });
}

export function useCreateVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVideoInput) => api.post<ApiResponse<Video>>('/videos', input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['videos'] }); },
  });
}

export function useUpdateVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateVideoInput & { id: string }) =>
      api.patch<ApiResponse<Video>>(`/videos/${id}`, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['videos'] });
      qc.invalidateQueries({ queryKey: ['video', vars.id] });
    },
  });
}

export function useDeleteVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ApiResponse>(`/videos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['videos'] }); },
  });
}

export function usePublishVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ApiResponse<Video>>(`/videos/${id}/publish`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['videos'] });
      qc.invalidateQueries({ queryKey: ['video', id] });
    },
  });
}

export function useUploadUrl() {
  return useMutation({
    mutationFn: (params: { filename: string; contentType: string }) =>
      api.post<ApiResponse<{ uploadUrl: string; s3Key: string }>>('/videos/upload-url', params),
  });
}
