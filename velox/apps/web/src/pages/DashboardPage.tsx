import { PageHeader } from '@/components/layout/PageHeader';

export function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Performance Dashboard"
        description="Video analytics and content health overview"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Videos', value: '—' },
          { label: 'Total Views (30d)', value: '—' },
          { label: 'Active Streams', value: '—' },
          { label: 'Pending QA', value: '—' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-velox-surface rounded-xl border border-velox-border p-5"
          >
            <p className="text-xs font-mono text-velox-text-muted uppercase tracking-wider">
              {stat.label}
            </p>
            <p className="text-2xl font-semibold mt-2">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-velox-surface rounded-xl border border-velox-border p-12 text-center">
        <p className="text-velox-text-secondary text-sm">
          Charts and analytics — coming in Phase 9
        </p>
      </div>
    </div>
  );
}
