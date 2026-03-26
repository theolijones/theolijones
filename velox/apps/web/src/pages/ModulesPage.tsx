import { PageHeader } from '@/components/layout/PageHeader';

export function ModulesPage() {
  return (
    <div>
      <PageHeader
        title="Module Builder"
        description="Create embeddable video modules for your sites and apps"
        actions={
          <button className="px-4 py-2 bg-velox-accent text-velox-bg text-sm font-medium rounded-lg hover:bg-velox-accent-hover transition-colors">
            New Module
          </button>
        }
      />
      <div className="bg-velox-surface rounded-xl border border-velox-border p-12 text-center">
        <p className="text-velox-text-secondary text-sm">
          Drag-and-drop module builder with AI assistant — coming in Phase 8
        </p>
      </div>
    </div>
  );
}
