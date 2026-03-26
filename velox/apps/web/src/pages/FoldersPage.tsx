import { PageHeader } from '@/components/layout/PageHeader';

export function FoldersPage() {
  return (
    <div>
      <PageHeader
        title="Folders"
        description="Organise videos into a hierarchical folder structure"
      />
      <div className="bg-velox-surface rounded-xl border border-velox-border p-12 text-center">
        <p className="text-velox-text-secondary text-sm">
          Folder tree browser — coming in Phase 2
        </p>
      </div>
    </div>
  );
}
