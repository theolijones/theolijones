import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { QARecord, QARule, ApiResponse, FlaggedSegment } from '@velox/shared';

export function useQARecords(status?: string) {
  return useQuery({
    queryKey: ['qa-records', status],
    queryFn: () => {
      const params = status ? `?status=${status}` : '';
      return api.get<ApiResponse<QARecord[]> & { total: number }>(`/qa${params}`);
    },
  });
}

export function useQARecord(id: string | undefined) {
  return useQuery({
    queryKey: ['qa-record', id],
    queryFn: () => api.get<ApiResponse<QARecord>>(`/qa/${id}`),
    enabled: !!id,
  });
}

export function useQARecordByVideo(videoId: string | undefined) {
  return useQuery({
    queryKey: ['qa-record-video', videoId],
    queryFn: () => api.get<ApiResponse<QARecord>>(`/qa/video/${videoId}`),
    enabled: !!videoId,
  });
}

export function useCreateQARecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (videoId: string) => api.post<ApiResponse<QARecord>>('/qa', { videoId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['qa-records'] }); },
  });
}

export function useUpdateQARecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: {
      id: string;
      status?: string;
      assignedTo?: string;
      transcriptNotes?: string;
      flaggedSegments?: FlaggedSegment[];
    }) => api.patch<ApiResponse<QARecord>>(`/qa/${id}`, input),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['qa-records'] });
      qc.invalidateQueries({ queryKey: ['qa-record', v.id] });
    },
  });
}

export function useRerunQAFlags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ApiResponse<QARecord>>(`/qa/${id}/rerun`, {}),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['qa-records'] });
      qc.invalidateQueries({ queryKey: ['qa-record', id] });
    },
  });
}

export function useDeleteQARecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ApiResponse>(`/qa/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['qa-records'] }); },
  });
}

// ── QA Rules ────────────────────────────────────────────────────────

export function useQARules() {
  return useQuery({
    queryKey: ['qa-rules'],
    queryFn: () => api.get<ApiResponse<QARule[]>>('/qa/rules/list'),
  });
}

export function useUpsertQARule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<QARule> & { name: string; type: QARule['type']; severity: string }) =>
      api.put<ApiResponse<QARule>>('/qa/rules', input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['qa-rules'] }); },
  });
}

export function useDeleteQARule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ApiResponse>(`/qa/rules/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['qa-rules'] }); },
  });
}
