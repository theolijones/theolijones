import { PageHeader } from '@/components/layout/PageHeader';

export function QAPage() {
  return (
    <div>
      <PageHeader
        title="Quality Assurance"
        description="Review and approve video content before publishing"
      />
      <div className="bg-velox-surface rounded-xl border border-velox-border p-12 text-center">
        <p className="text-velox-text-secondary text-sm">
          QA queue and review workflow — coming in Phase 7
        </p>
      </div>
    </div>
  );
}
