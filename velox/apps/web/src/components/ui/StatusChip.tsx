import { cn } from '@/lib/cn';
import type { VideoStatus, LivestreamStatus } from '@velox/shared';

type ChipStatus = VideoStatus | LivestreamStatus;

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  uploading: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
  processing: { bg: 'bg-velox-amber-muted', text: 'text-velox-amber', dot: 'bg-velox-amber' },
  transcribing: { bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-400' },
  transcribed: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', dot: 'bg-cyan-400' },
  published: { bg: 'bg-velox-green-muted', text: 'text-velox-green', dot: 'bg-velox-green' },
  scheduled: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', dot: 'bg-indigo-400' },
  failed: { bg: 'bg-velox-red-muted', text: 'text-velox-red', dot: 'bg-velox-red' },
  archived: { bg: 'bg-gray-500/10', text: 'text-gray-400', dot: 'bg-gray-400' },
  idle: { bg: 'bg-gray-500/10', text: 'text-gray-400', dot: 'bg-gray-400' },
  starting: { bg: 'bg-velox-amber-muted', text: 'text-velox-amber', dot: 'bg-velox-amber' },
  live: { bg: 'bg-velox-red-muted', text: 'text-velox-red', dot: 'bg-velox-red animate-pulse' },
  stopping: { bg: 'bg-velox-amber-muted', text: 'text-velox-amber', dot: 'bg-velox-amber' },
  error: { bg: 'bg-velox-red-muted', text: 'text-velox-red', dot: 'bg-velox-red' },
};

interface StatusChipProps {
  status: ChipStatus;
  className?: string;
}

export function StatusChip({ status, className }: StatusChipProps) {
  const config = statusConfig[status] || statusConfig.archived;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium uppercase tracking-wider',
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
      {status}
    </span>
  );
}
