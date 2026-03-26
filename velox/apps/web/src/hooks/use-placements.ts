import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Placement, CreatePlacementInput, UpdatePlacementInput, Video, ApiResponse, ScheduleOverride } from '@velox/shared';

export function usePlacements() {
  return useQuery({
    queryKey: ['placements'],
    queryFn: () => api.get<ApiResponse<Placement[]> & { total: number }>('/placements'),
  });
}

export function usePlacement(id: string | undefined) {
  return useQuery({
    queryKey: ['placement', id],
    queryFn: () => api.get<ApiResponse<Placement>>(`/placements/${id}`),
    enabled: !!id,
  });
}

export function usePlacementVideos(id: string | undefined) {
  return useQuery({
    queryKey: ['placement-videos', id],
    queryFn: () => api.get<ApiResponse<{ placementId: string; videos: Video[] }>>(`/placements/${id}/videos`),
    enabled: !!id,
  });
}

export function usePlacementOverrides(id: string | undefined) {
  return useQuery({
    queryKey: ['placement-overrides', id],
    queryFn: () => api.get<ApiResponse<ScheduleOverride[]>>(`/placements/${id}/overrides`),
    enabled: !!id,
  });
}

export function useCreatePlacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePlacementInput) => api.post<ApiResponse<Placement>>('/placements', input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['placements'] }); },
  });
}

export function useUpdatePlacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdatePlacementInput & { id: string }) =>
      api.patch<ApiResponse<Placement>>(`/placements/${id}`, input),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['placements'] });
      qc.invalidateQueries({ queryKey: ['placement', v.id] });
      qc.invalidateQueries({ queryKey: ['placement-videos', v.id] });
    },
  });
}

export function useDeletePlacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ApiResponse>(`/placements/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['placements'] }); },
  });
}

export function useReorderPlacementVideos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, videoIds }: { id: string; videoIds: string[] }) =>
      api.patch<ApiResponse<Placement>>(`/placements/${id}/videos`, { videoIds }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['placement-videos', v.id] });
    },
  });
}
