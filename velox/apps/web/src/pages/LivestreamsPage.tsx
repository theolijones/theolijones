import { PageHeader } from '@/components/layout/PageHeader';

export function LivestreamsPage() {
  return (
    <div>
      <PageHeader
        title="Live Streams"
        description="Manage live stream channels and ingest configurations"
        actions={
          <button className="px-4 py-2 bg-velox-accent text-velox-bg text-sm font-medium rounded-lg hover:bg-velox-accent-hover transition-colors">
            New Livestream
          </button>
        }
      />
      <div className="bg-velox-surface rounded-xl border border-velox-border p-12 text-center">
        <p className="text-velox-text-secondary text-sm">
          Livestream management with RTMP/SRT support — coming in Phase 6
        </p>
      </div>
    </div>
  );
}
