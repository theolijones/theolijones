import {
  Video, Eye, Radio, Shield, TrendingUp, BarChart3, Activity,
  ArrowUpRight, ArrowDownRight, Clock, Film,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusChip } from '@/components/ui/StatusChip';
import { useDashboard } from '@/hooks/use-analytics';
import { cn } from '@/lib/cn';

const STATUS_COLORS: Record<string, string> = {
  uploading: 'bg-blue-400',
  processing: 'bg-velox-amber',
  transcribing: 'bg-purple-400',
  transcribed: 'bg-cyan-400',
  published: 'bg-velox-green',
  scheduled: 'bg-indigo-400',
  failed: 'bg-velox-red',
  archived: 'bg-gray-400',
};

export function DashboardPage() {
  const { data: dashData, isLoading } = useDashboard();
  const dashboard = dashData?.data;

  const stats = dashboard?.stats || { totalVideos: 0, publishedVideos: 0, activeStreams: 0, pendingQA: 0 };
  const viewsTrend = dashboard?.viewsTrend || [];
  const topPerformers = dashboard?.topPerformers || [];
  const recentVideos = dashboard?.recentVideos || [];
  const statusDistribution = dashboard?.statusDistribution || [];

  // Calculate max views for chart scaling
  const maxViews = Math.max(...viewsTrend.map((d) => d.views), 1);
  const totalViews = viewsTrend.reduce((sum, d) => sum + d.views, 0);
  const totalStatusCount = statusDistribution.reduce((sum, d) => sum + d.count, 0);

  return (
    <div>
      <PageHeader
        title="Performance Dashboard"
        description="Video analytics and content health overview"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Video className="w-5 h-5" />}
          label="Total Videos"
          value={stats.totalVideos}
          accent="text-velox-accent"
          loading={isLoading}
        />
        <StatCard
          icon={<Eye className="w-5 h-5" />}
          label="Views (7d)"
          value={totalViews.toLocaleString()}
          accent="text-blue-400"
          loading={isLoading}
        />
        <StatCard
          icon={<Radio className="w-5 h-5" />}
          label="Active Streams"
          value={stats.activeStreams}
          accent="text-velox-red"
          loading={isLoading}
          pulse={stats.activeStreams > 0}
        />
        <StatCard
          icon={<Shield className="w-5 h-5" />}
          label="Pending QA"
          value={stats.pendingQA}
          accent="text-velox-amber"
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Views Trend Chart */}
        <div className="lg:col-span-2 bg-velox-surface rounded-xl border border-velox-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" />
              Views Trend (7 Days)
            </h3>
            <span className="text-xs text-velox-text-muted">{totalViews.toLocaleString()} total</span>
          </div>
          {viewsTrend.length > 0 ? (
            <div className="flex items-end gap-2 h-40">
              {viewsTrend.map((d, i) => {
                const height = (d.views / maxViews) * 100;
                const isToday = i === viewsTrend.length - 1;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-mono text-velox-text-muted">{d.views.toLocaleString()}</span>
                    <div
                      className={cn(
                        'w-full rounded-t transition-all',
                        isToday ? 'bg-velox-accent' : 'bg-velox-accent/30'
                      )}
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                    <span className="text-[9px] font-mono text-velox-text-muted">
                      {new Date(d.date).toLocaleDateString('en', { weekday: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-sm text-velox-text-muted">
              No data available
            </div>
          )}
        </div>

        {/* Content Health */}
        <div className="bg-velox-surface rounded-xl border border-velox-border p-5">
          <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider flex items-center gap-2 mb-4">
            <Activity className="w-3.5 h-3.5" />
            Content Health
          </h3>
          {statusDistribution.length > 0 ? (
            <div className="space-y-2.5">
              {/* Stacked bar */}
              <div className="h-3 rounded-full overflow-hidden flex">
                {statusDistribution.map((d) => (
                  <div
                    key={d.status}
                    className={cn('h-full', STATUS_COLORS[d.status] || 'bg-gray-500')}
                    style={{ width: `${(d.count / totalStatusCount) * 100}%` }}
                  />
                ))}
              </div>
              {/* Legend */}
              <div className="space-y-1.5">
                {statusDistribution.map((d) => (
                  <div key={d.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full', STATUS_COLORS[d.status] || 'bg-gray-500')} />
                      <span className="text-xs capitalize">{d.status}</span>
                    </div>
                    <span className="text-xs font-mono text-velox-text-muted">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-velox-text-muted">
              No videos yet
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="bg-velox-surface rounded-xl border border-velox-border p-5">
          <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider flex items-center gap-2 mb-4">
            <BarChart3 className="w-3.5 h-3.5" />
            Top Performers
          </h3>
          {topPerformers.length > 0 ? (
            <div className="space-y-2">
              {topPerformers.map((video, idx) => (
                <div key={video.id} className="flex items-center gap-3 bg-velox-bg rounded-lg p-2.5">
                  <span className="text-xs font-mono text-velox-text-muted w-5">{idx + 1}</span>
                  <div className="w-10 h-7 bg-velox-border rounded flex items-center justify-center shrink-0">
                    <Film className="w-3.5 h-3.5 text-velox-text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{video.title}</div>
                    <div className="flex items-center gap-3 text-[10px] text-velox-text-muted">
                      <span className="flex items-center gap-0.5">
                        <Eye className="w-3 h-3" />
                        {video.views.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <ArrowUpRight className="w-3 h-3 text-velox-green" />
                        {video.completionRate}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-velox-text-muted">
              No published videos yet
            </div>
          )}
        </div>

        {/* Recent Videos */}
        <div className="bg-velox-surface rounded-xl border border-velox-border p-5">
          <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider flex items-center gap-2 mb-4">
            <Clock className="w-3.5 h-3.5" />
            Recent Videos
          </h3>
          {recentVideos.length > 0 ? (
            <div className="space-y-2">
              {recentVideos.map((video) => (
                <div key={video.id} className="flex items-center gap-3 bg-velox-bg rounded-lg p-2.5">
                  <div className="w-10 h-7 bg-velox-border rounded flex items-center justify-center shrink-0">
                    <Film className="w-3.5 h-3.5 text-velox-text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{video.title}</div>
                    <div className="text-[10px] text-velox-text-muted">
                      {new Date(video.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <StatusChip status={video.status as any} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-velox-text-muted">
              No videos yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Stat Card Component ─────────────────────────────────────────────

function StatCard({ icon, label, value, accent, loading, pulse }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
  loading?: boolean;
  pulse?: boolean;
}) {
  return (
    <div className="bg-velox-surface rounded-xl border border-velox-border p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-mono text-velox-text-muted uppercase tracking-wider">{label}</p>
        <span className={cn(accent, pulse && 'animate-pulse')}>{icon}</span>
      </div>
      <p className="text-2xl font-semibold">
        {loading ? (
          <span className="inline-block w-16 h-7 bg-velox-border rounded animate-pulse" />
        ) : (
          value
        )}
      </p>
    </div>
  );
}
