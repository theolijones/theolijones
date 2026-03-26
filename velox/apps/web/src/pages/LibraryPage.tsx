import { PageHeader } from '@/components/layout/PageHeader';

export function LibraryPage() {
  return (
    <div>
      <PageHeader
        title="Video Library"
        description="Browse and manage your video content"
        actions={
          <button className="px-4 py-2 bg-velox-accent text-velox-bg text-sm font-medium rounded-lg hover:bg-velox-accent-hover transition-colors">
            Upload Video
          </button>
        }
      />
      <div className="bg-velox-surface rounded-xl border border-velox-border p-12 text-center">
        <p className="text-velox-text-secondary text-sm">
          Video library with grid/list view — coming in Phase 2
        </p>
      </div>
    </div>
  );
}
