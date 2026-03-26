import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Livestream, CreateLivestreamInput, UpdateLivestreamInput, ApiResponse } from '@velox/shared';

export function useLivestreams() {
  return useQuery({
    queryKey: ['livestreams'],
    queryFn: () => api.get<ApiResponse<Livestream[]> & { total: number }>('/livestreams'),
  });
}

export function useLivestream(id: string | undefined) {
  return useQuery({
    queryKey: ['livestream', id],
    queryFn: () => api.get<ApiResponse<Livestream>>(`/livestreams/${id}`),
    enabled: !!id,
    refetchInterval: 5000, // Poll every 5s for live status
  });
}

export function useCreateLivestream() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLivestreamInput) => api.post<ApiResponse<Livestream>>('/livestreams', input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['livestreams'] }); },
  });
}

export function useStartLivestream() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ApiResponse<Livestream>>(`/livestreams/${id}/start`, {}),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['livestreams'] });
      qc.invalidateQueries({ queryKey: ['livestream', id] });
    },
  });
}

export function useStopLivestream() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ApiResponse<Livestream>>(`/livestreams/${id}/stop`, {}),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['livestreams'] });
      qc.invalidateQueries({ queryKey: ['livestream', id] });
    },
  });
}

export function useDeleteLivestream() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ApiResponse>(`/livestreams/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['livestreams'] }); },
  });
}
