import { PageHeader } from '@/components/layout/PageHeader';

export function PlacementsPage() {
  return (
    <div>
      <PageHeader
        title="Placements"
        description="Configure video placements and content delivery targets"
      />
      <div className="bg-velox-surface rounded-xl border border-velox-border p-12 text-center">
        <p className="text-velox-text-secondary text-sm">
          Placement manager with rules engine — coming in Phase 5
        </p>
      </div>
    </div>
  );
}
