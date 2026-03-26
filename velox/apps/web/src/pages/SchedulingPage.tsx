import { PageHeader } from '@/components/layout/PageHeader';

export function SchedulingPage() {
  return (
    <div>
      <PageHeader
        title="Scheduling"
        description="Schedule video publishing and placement overrides"
      />
      <div className="bg-velox-surface rounded-xl border border-velox-border p-12 text-center">
        <p className="text-velox-text-secondary text-sm">
          Scheduling timeline and rules — coming in Phase 5
        </p>
      </div>
    </div>
  );
}
