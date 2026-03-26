import { PageHeader } from '@/components/layout/PageHeader';

export function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage metadata schema, QA rules, and integrations"
      />
      <div className="space-y-4">
        {[
          { title: 'Metadata Schema', desc: 'Define custom metadata fields for videos' },
          { title: 'QA Rules', desc: 'Configure automated content flagging rules' },
          { title: 'Integrations', desc: 'Google Analytics, Bitmovin, and API keys' },
          { title: 'Users & Permissions', desc: 'Manage team access and roles' },
        ].map((section) => (
          <div
            key={section.title}
            className="bg-velox-surface rounded-xl border border-velox-border p-5 hover:border-velox-border-light transition-colors cursor-pointer"
          >
            <h3 className="text-sm font-medium">{section.title}</h3>
            <p className="text-xs text-velox-text-muted mt-1">{section.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
