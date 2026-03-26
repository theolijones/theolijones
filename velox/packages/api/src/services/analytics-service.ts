import { dynamoDb } from '@velox/aws-clients';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAMES } from '@velox/shared';
import type { Video, Livestream, QARecord } from '@velox/shared';

/**
 * Analytics service — aggregates data from DynamoDB tables and
 * optionally integrates with GA4 Data API for video performance metrics.
 *
 * In production this would use the Google Analytics Data API (v1beta)
 * to pull real view counts, watch times, etc. For now we compute
 * aggregate stats from the DynamoDB tables.
 */

export interface DashboardData {
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

export async function getDashboardData(): Promise<DashboardData> {
  // Fetch all tables in parallel
  const [videosResult, streamsResult, qaResult] = await Promise.all([
    dynamoDb.send(new ScanCommand({ TableName: TABLE_NAMES.VIDEOS })),
    dynamoDb.send(new ScanCommand({ TableName: TABLE_NAMES.LIVESTREAMS })),
    dynamoDb.send(new ScanCommand({ TableName: TABLE_NAMES.QA_RECORDS })),
  ]);

  const videos = (videosResult.Items || []) as Video[];
  const streams = (streamsResult.Items || []) as Livestream[];
  const qaRecords = (qaResult.Items || []) as QARecord[];

  // Content health — status breakdown
  const statusCounts: Record<string, number> = {};
  for (const v of videos) {
    statusCounts[v.status] = (statusCounts[v.status] || 0) + 1;
  }

  // Active livestreams
  const activeStreams = streams.filter((s) => s.status === 'live').length;

  // Pending QA
  const pendingQA = qaRecords.filter((q) => q.status === 'pending' || q.status === 'in_review').length;

  // Recent videos (last 10)
  const sortedVideos = [...videos].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const recentVideos = sortedVideos.slice(0, 10).map((v) => ({
    id: v.id,
    title: v.title,
    status: v.status,
    createdAt: v.createdAt,
  }));

  // Simulated top performers (in production, from GA4 Data API)
  const published = videos.filter((v) => v.status === 'published');
  const topPerformers = published.slice(0, 5).map((v, i) => ({
    id: v.id,
    title: v.title,
    views: Math.floor(Math.random() * 10000) + 500,
    completionRate: Math.round((70 + Math.random() * 25) * 10) / 10,
  }));
  topPerformers.sort((a, b) => b.views - a.views);

  // Simulated 7-day views trend (in production, from GA4 Data API)
  const viewsTrend: Array<{ date: string; views: number }> = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    viewsTrend.push({
      date: date.toISOString().slice(0, 10),
      views: Math.floor(Math.random() * 5000) + 1000,
    });
  }

  // Status distribution for chart
  const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
  }));

  return {
    stats: {
      totalVideos: videos.length,
      publishedVideos: published.length,
      activeStreams,
      pendingQA,
    },
    contentHealth: statusCounts,
    recentVideos,
    topPerformers,
    viewsTrend,
    statusDistribution,
  };
}

export interface VideoAnalytics {
  videoId: string;
  views: number;
  uniqueViewers: number;
  avgWatchTime: number;
  completionRate: number;
  milestones: { '25': number; '50': number; '75': number; '100': number };
  viewsByDay: Array<{ date: string; views: number }>;
}

export async function getVideoAnalytics(videoId: string): Promise<VideoAnalytics> {
  // In production, this would call GA4 Data API with video_id dimension
  // For now, return simulated data
  const viewsByDay: Array<{ date: string; views: number }> = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    viewsByDay.push({
      date: date.toISOString().slice(0, 10),
      views: Math.floor(Math.random() * 500) + 50,
    });
  }

  const totalViews = viewsByDay.reduce((sum, d) => sum + d.views, 0);

  return {
    videoId,
    views: totalViews,
    uniqueViewers: Math.floor(totalViews * 0.7),
    avgWatchTime: Math.round((120 + Math.random() * 300) * 10) / 10,
    completionRate: Math.round((60 + Math.random() * 35) * 10) / 10,
    milestones: {
      '25': Math.floor(totalViews * 0.85),
      '50': Math.floor(totalViews * 0.65),
      '75': Math.floor(totalViews * 0.45),
      '100': Math.floor(totalViews * 0.3),
    },
    viewsByDay,
  };
}
