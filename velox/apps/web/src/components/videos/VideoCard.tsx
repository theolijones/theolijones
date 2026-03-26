import { Link } from 'react-router-dom';
import { Film, Clock, HardDrive } from 'lucide-react';
import { StatusChip } from '@/components/ui/StatusChip';
import { cn } from '@/lib/cn';
import type { Video } from '@velox/shared';

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '--';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso?: string): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface VideoCardProps {
  video: Video;
  view: 'grid' | 'list';
}

export function VideoCard({ video, view }: VideoCardProps) {
  if (view === 'list') {
    return (
      <Link
        to={`/videos/${video.id}`}
        className="flex items-center gap-4 bg-velox-surface border border-velox-border rounded-lg p-3 hover:border-velox-border-light transition-colors group"
      >
        {/* Thumbnail */}
        <div className="w-40 h-[90px] rounded-md bg-velox-bg overflow-hidden shrink-0 relative">
          {video.thumbnailUrl ? (
            <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="w-8 h-8 text-velox-text-muted" />
            </div>
          )}
          <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] font-mono text-white px-1.5 py-0.5 rounded">
            {formatDuration(video.duration)}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium truncate group-hover:text-velox-accent transition-colors">
            {video.title}
          </h3>
          <p className="text-xs text-velox-text-muted mt-0.5 truncate">{video.description || 'No description'}</p>
          <div className="flex items-center gap-3 mt-2">
            <StatusChip status={video.status} />
            {video.tags.length > 0 && (
              <span className="text-[10px] font-mono text-velox-text-muted truncate">
                {video.tags.slice(0, 3).join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Meta columns */}
        <div className="hidden md:flex items-center gap-6 text-xs text-velox-text-secondary shrink-0">
          <span className="flex items-center gap-1.5 w-20">
            <Clock className="w-3 h-3" />
            {formatDuration(video.duration)}
          </span>
          <span className="flex items-center gap-1.5 w-20">
            <HardDrive className="w-3 h-3" />
            {formatFileSize(video.fileSize)}
          </span>
          <span className="w-24 text-right">{formatDate(video.uploadedAt)}</span>
        </div>
      </Link>
    );
  }

  // Grid view
  return (
    <Link
      to={`/videos/${video.id}`}
      className="bg-velox-surface border border-velox-border rounded-xl overflow-hidden hover:border-velox-border-light transition-colors group"
    >
      {/* 16:9 Thumbnail */}
      <div className="aspect-video bg-velox-bg relative overflow-hidden">
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-12 h-12 text-velox-text-muted" />
          </div>
        )}
        {/* Duration overlay */}
        <span className="absolute bottom-2 right-2 bg-black/80 text-[11px] font-mono text-white px-2 py-0.5 rounded">
          {formatDuration(video.duration)}
        </span>
        {/* Status overlay */}
        <div className="absolute top-2 left-2">
          <StatusChip status={video.status} />
        </div>
      </div>

      {/* Card body */}
      <div className="p-3">
        <h3 className="text-sm font-medium truncate group-hover:text-velox-accent transition-colors">
          {video.title}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] font-mono text-velox-text-muted">
            {video.resolution || '--'}
          </span>
          <span className="text-[11px] text-velox-text-muted">
            {formatDate(video.uploadedAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}
