import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { ApiResponse } from '@velox/shared';

interface DashboardData {
  stats: {
    totalVideos: number;
    publishedVideos: number;
    activeStreams: number;
    pendingQA: number;
  };
  contentHealth: Record<string, number>;
  recentVideos: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
  topPerformers: Array<{
    id: string;
    title: string;
    views: number;
    completionRate: number;
  }>;
  viewsTrend: Array<{ date: string; views: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
}

interface VideoAnalytics {
  videoId: string;
  views: number;
  uniqueViewers: number;
  avgWatchTime: number;
  completionRate: number;
  milestones: { '25': number; '50': number; '75': number; '100': number };
  viewsByDay: Array<{ date: string; views: number }>;
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<ApiResponse<DashboardData>>('/analytics/dashboard'),
    refetchInterval: 30000, // refresh every 30s
  });
}

export function useVideoAnalytics(videoId: string | undefined) {
  return useQuery({
    queryKey: ['video-analytics', videoId],
    queryFn: () => api.get<ApiResponse<VideoAnalytics>>(`/analytics/video/${videoId}`),
    enabled: !!videoId,
  });
}
