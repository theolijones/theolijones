import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { ApiResponse } from '@velox/shared';

export interface TranscriptSegment {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
  speaker?: string;
}

interface TranscriptData {
  videoId: string;
  segments: TranscriptSegment[];
  fullText: string;
  language: string;
}

export function useTranscript(videoId: string | undefined) {
  return useQuery({
    queryKey: ['transcript', videoId],
    queryFn: () => api.get<ApiResponse<TranscriptData>>(`/videos/${videoId}/transcript`),
    enabled: !!videoId,
    retry: false,
  });
}

export function useUpdateTranscript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ videoId, segments }: { videoId: string; segments: TranscriptSegment[] }) =>
      api.patch<ApiResponse<{ captionUrl: string }>>(`/videos/${videoId}/transcript`, { segments }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['transcript', vars.videoId] });
      qc.invalidateQueries({ queryKey: ['video', vars.videoId] });
    },
  });
}
