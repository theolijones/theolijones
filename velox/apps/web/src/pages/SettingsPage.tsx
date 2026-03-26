import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { SchemaEditor } from '@/components/settings/SchemaEditor';
import { cn } from '@/lib/cn';

const tabs = [
  { key: 'schema', label: 'Metadata Schema' },
  { key: 'qa-rules', label: 'QA Rules' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'users', label: 'Users & Permissions' },
] as const;

type TabKey = typeof tabs[number]['key'];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('schema');

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage metadata schema, QA rules, and integrations"
      />

      <div className="flex gap-6">
        {/* Tab nav */}
        <div className="w-48 shrink-0 space-y-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                activeTab === tab.key
                  ? 'bg-velox-accent-muted text-velox-accent font-medium'
                  : 'text-velox-text-secondary hover:text-velox-text-primary hover:bg-velox-surface-hover'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          <div className="bg-velox-surface rounded-xl border border-velox-border p-5">
            {activeTab === 'schema' && <SchemaEditor />}
            {activeTab === 'qa-rules' && (
              <div className="text-center py-12">
                <p className="text-sm text-velox-text-secondary">QA rules configuration — coming in Phase 7</p>
              </div>
            )}
            {activeTab === 'integrations' && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Google Analytics</h3>
                <div>
                  <label className="block text-[10px] font-mono text-velox-text-muted uppercase mb-1">
                    GA4 Measurement ID
                  </label>
                  <input
                    type="text"
                    placeholder="G-XXXXXXXXXX"
                    className="w-full max-w-sm bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm font-mono text-velox-text-primary focus:outline-none focus:border-velox-accent"
                  />
                  <p className="text-[10px] text-velox-text-muted mt-1">
                    Set via VITE_GA_MEASUREMENT_ID environment variable
                  </p>
                </div>
                <div className="pt-4 border-t border-velox-border">
                  <h3 className="text-sm font-medium">Bitmovin Player</h3>
                  <div className="mt-2">
                    <label className="block text-[10px] font-mono text-velox-text-muted uppercase mb-1">
                      Player Licence Key
                    </label>
                    <input
                      type="text"
                      value="4578c6b5-0415-4969-babb-2ade8182e493"
                      readOnly
                      className="w-full max-w-sm bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm font-mono text-velox-text-secondary focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'users' && (
              <div className="text-center py-12">
                <p className="text-sm text-velox-text-secondary">User management via AWS Cognito — manage in AWS Console</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
