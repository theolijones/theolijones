import { useState } from 'react';
import {
  Plus, Trash2, Code2, Copy, Check, ChevronRight, Eye,
  Layout, LayoutGrid, Film, PlayCircle, List, Radio,
  Columns3, Sun, Moon, Settings2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  useModules, useModule, useModuleEmbed, useCreateModule, useUpdateModule, useDeleteModule,
} from '@/hooks/use-modules';
import { cn } from '@/lib/cn';
import type { ModuleConfig, ModuleType } from '@velox/shared';

const MODULE_TYPES: { value: ModuleType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'feature-video', label: 'Feature Video', icon: <PlayCircle className="w-5 h-5" />, description: 'Hero player with metadata' },
  { value: 'carousel', label: 'Carousel', icon: <Columns3 className="w-5 h-5" />, description: 'Horizontal scrolling row' },
  { value: 'video-article', label: 'Video + Article', icon: <Layout className="w-5 h-5" />, description: 'Player beside text content' },
  { value: 'playlist', label: 'Playlist', icon: <List className="w-5 h-5" />, description: 'Player with sidebar queue' },
  { value: 'live-player', label: 'Live Player', icon: <Radio className="w-5 h-5" />, description: 'Live stream with status badge' },
  { value: 'grid', label: 'Grid', icon: <LayoutGrid className="w-5 h-5" />, description: 'Multi-column video grid' },
];

export function ModulesPage() {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ModuleType>('carousel');

  const { data: listData } = useModules();
  const createModule = useCreateModule();

  const modules = listData?.data || [];

  const handleCreate = async () => {
    if (!newName) return;
    const result = await createModule.mutateAsync({ name: newName, type: newType });
    setSelectedId(result.data?.id);
    setShowNewForm(false);
    setNewName('');
  };

  return (
    <div>
      <PageHeader
        title="Module Builder"
        description="Create embeddable video modules for your sites and apps"
        actions={
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-velox-accent text-velox-bg text-sm font-medium rounded-lg hover:bg-velox-accent-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Module
          </button>
        }
      />

      <div className="flex gap-6">
        {/* Left panel — module list */}
        <div className="w-72 shrink-0 space-y-2">
          {showNewForm && (
            <div className="bg-velox-surface rounded-xl border border-velox-accent/30 p-3 space-y-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Module name"
                className="w-full bg-velox-bg border border-velox-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-velox-accent"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-1.5">
                {MODULE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setNewType(t.value)}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1.5 text-[11px] rounded border transition-colors',
                      newType === t.value
                        ? 'border-velox-accent/50 bg-velox-accent/5 text-velox-accent'
                        : 'border-velox-border text-velox-text-muted hover:text-velox-text-secondary'
                    )}
                  >
                    {t.icon}
                    <span className="truncate">{t.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} className="flex-1 px-2 py-1 bg-velox-accent text-velox-bg text-xs rounded hover:bg-velox-accent-hover">
                  Create
                </button>
                <button onClick={() => setShowNewForm(false)} className="flex-1 px-2 py-1 text-xs text-velox-text-muted hover:text-velox-text-primary">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {modules.map((mod) => {
            const typeInfo = MODULE_TYPES.find((t) => t.value === mod.type);
            return (
              <button
                key={mod.id}
                onClick={() => setSelectedId(mod.id)}
                className={cn(
                  'w-full text-left bg-velox-surface rounded-xl border p-3 transition-colors',
                  selectedId === mod.id ? 'border-velox-accent/50' : 'border-velox-border hover:border-velox-border-light'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">{mod.name}</span>
                  <ChevronRight className="w-4 h-4 text-velox-text-muted shrink-0" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-velox-text-muted">{typeInfo?.icon}</span>
                  <span className="text-[10px] font-mono text-velox-text-muted uppercase">{mod.type}</span>
                  <span className={cn(
                    'ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded',
                    mod.styling.theme === 'light' ? 'bg-gray-200 text-gray-700' : 'bg-gray-700 text-gray-300'
                  )}>
                    {mod.styling.theme || 'dark'}
                  </span>
                </div>
              </button>
            );
          })}

          {modules.length === 0 && !showNewForm && (
            <div className="text-center py-8 text-xs text-velox-text-muted">
              No modules yet
            </div>
          )}
        </div>

        {/* Right panel — module editor */}
        <div className="flex-1 min-w-0">
          {selectedId ? (
            <ModuleEditor id={selectedId} onDelete={() => setSelectedId(undefined)} />
          ) : (
            <div className="bg-velox-surface rounded-xl border border-velox-border p-12 text-center">
              <Code2 className="w-10 h-10 text-velox-text-muted mx-auto mb-3" />
              <p className="text-sm text-velox-text-secondary">Select a module to configure or create a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Module Editor ───────────────────────────────────────────────────

function ModuleEditor({ id, onDelete }: { id: string; onDelete: () => void }) {
  const { data: moduleData } = useModule(id);
  const { data: embedData } = useModuleEmbed(id);
  const updateModule = useUpdateModule();
  const deleteModule = useDeleteModule();
  const [showEmbed, setShowEmbed] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const mod = moduleData?.data;
  const embed = embedData?.data;

  if (!mod) return null;

  const typeInfo = MODULE_TYPES.find((t) => t.value === mod.type);

  const handleUpdate = (updates: Partial<ModuleConfig>) => {
    updateModule.mutate({ id: mod.id, ...updates });
  };

  const handleStylingUpdate = (updates: Partial<ModuleConfig['styling']>) => {
    handleUpdate({ styling: { ...mod.styling, ...updates } });
  };

  const handleDelete = async () => {
    if (!confirm('Delete this module?')) return;
    await deleteModule.mutateAsync(mod.id);
    onDelete();
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-velox-text-muted">{typeInfo?.icon}</span>
          <div>
            <h2 className="text-lg font-semibold">{mod.name}</h2>
            <span className="text-xs font-mono text-velox-text-muted uppercase">{mod.type}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEmbed(!showEmbed)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors',
              showEmbed
                ? 'bg-velox-accent/10 border-velox-accent/30 text-velox-accent'
                : 'bg-velox-surface border-velox-border text-velox-text-secondary hover:text-velox-text-primary'
            )}
          >
            <Code2 className="w-3.5 h-3.5" />
            Embed Code
          </button>
          <button onClick={handleDelete} className="p-2 text-velox-text-muted hover:text-velox-red transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Module Preview */}
      <div className="bg-velox-surface rounded-xl border border-velox-border overflow-hidden">
        <div className="px-4 py-2.5 border-b border-velox-border flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-velox-text-muted" />
          <span className="text-xs font-mono text-velox-text-muted uppercase tracking-wider">Preview</span>
        </div>
        <div className={cn(
          'p-6',
          mod.styling.theme === 'light' ? 'bg-white' : 'bg-[#0A0A0F]'
        )}>
          <ModulePreview module={mod} />
        </div>
      </div>

      {/* Styling Controls */}
      <div className="bg-velox-surface rounded-xl border border-velox-border p-4 space-y-4">
        <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider flex items-center gap-2">
          <Settings2 className="w-3.5 h-3.5" />
          Module Settings
        </h3>

        {/* Name & Title */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-velox-text-muted block mb-1">Module Name</label>
            <input
              type="text"
              value={mod.name}
              onChange={(e) => handleUpdate({ name: e.target.value })}
              className="w-full bg-velox-bg border border-velox-border rounded px-3 py-2 text-sm focus:outline-none focus:border-velox-accent"
            />
          </div>
          <div>
            <label className="text-xs text-velox-text-muted block mb-1">Display Title</label>
            <input
              type="text"
              value={mod.title || ''}
              onChange={(e) => handleUpdate({ title: e.target.value })}
              placeholder="Optional heading above module"
              className="w-full bg-velox-bg border border-velox-border rounded px-3 py-2 text-sm focus:outline-none focus:border-velox-accent"
            />
          </div>
        </div>

        {/* Theme */}
        <div>
          <label className="text-xs text-velox-text-muted block mb-2">Theme</label>
          <div className="flex gap-2">
            <button
              onClick={() => handleStylingUpdate({ theme: 'dark' })}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors',
                mod.styling.theme === 'dark'
                  ? 'border-velox-accent/50 bg-velox-accent/5 text-velox-accent'
                  : 'border-velox-border text-velox-text-muted hover:text-velox-text-secondary'
              )}
            >
              <Moon className="w-4 h-4" /> Dark
            </button>
            <button
              onClick={() => handleStylingUpdate({ theme: 'light' })}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors',
                mod.styling.theme === 'light'
                  ? 'border-velox-accent/50 bg-velox-accent/5 text-velox-accent'
                  : 'border-velox-border text-velox-text-muted hover:text-velox-text-secondary'
              )}
            >
              <Sun className="w-4 h-4" /> Light
            </button>
          </div>
        </div>

        {/* Grid columns */}
        {(mod.type === 'grid' || mod.type === 'carousel') && (
          <div>
            <label className="text-xs text-velox-text-muted block mb-1">Columns</label>
            <div className="flex gap-2">
              {[2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => handleStylingUpdate({ columns: n })}
                  className={cn(
                    'w-10 h-10 flex items-center justify-center rounded-lg border text-sm font-mono transition-colors',
                    mod.styling.columns === n
                      ? 'border-velox-accent/50 bg-velox-accent/5 text-velox-accent'
                      : 'border-velox-border text-velox-text-muted hover:text-velox-text-secondary'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Toggle switches */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'showTitle' as const, label: 'Show Title' },
            { key: 'showDescription' as const, label: 'Show Description' },
            { key: 'showDuration' as const, label: 'Show Duration' },
            { key: 'autoPlay' as const, label: 'Autoplay' },
            { key: 'autoAdvance' as const, label: 'Auto-advance' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2.5 bg-velox-bg rounded-lg px-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={mod.styling[key] ?? false}
                onChange={(e) => handleStylingUpdate({ [key]: e.target.checked })}
                className="accent-velox-accent"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>

        {/* Video Query */}
        <div>
          <label className="text-xs text-velox-text-muted block mb-1">Video Source</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-velox-text-muted block mb-0.5">Folder ID</label>
              <input
                type="text"
                value={mod.videoQuery?.folderId || ''}
                onChange={(e) => handleUpdate({ videoQuery: { ...mod.videoQuery, folderId: e.target.value || undefined } })}
                placeholder="Optional"
                className="w-full bg-velox-bg border border-velox-border rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-velox-accent"
              />
            </div>
            <div>
              <label className="text-[10px] text-velox-text-muted block mb-0.5">Limit</label>
              <input
                type="number"
                min="1"
                max="50"
                value={mod.videoQuery?.limit || 10}
                onChange={(e) => handleUpdate({ videoQuery: { ...mod.videoQuery, limit: parseInt(e.target.value) } })}
                className="w-full bg-velox-bg border border-velox-border rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-velox-accent"
              />
            </div>
          </div>
          <div className="mt-2">
            <label className="text-[10px] text-velox-text-muted block mb-0.5">Tags (comma-separated)</label>
            <input
              type="text"
              value={(mod.videoQuery?.tags || []).join(', ')}
              onChange={(e) => handleUpdate({
                videoQuery: { ...mod.videoQuery, tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) },
              })}
              placeholder="e.g. featured, trending"
              className="w-full bg-velox-bg border border-velox-border rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-velox-accent"
            />
          </div>
        </div>
      </div>

      {/* Embed Code */}
      {showEmbed && embed && (
        <div className="bg-velox-surface rounded-xl border border-velox-border p-4 space-y-3">
          <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider flex items-center gap-2">
            <Code2 className="w-3.5 h-3.5" />
            Embed Code
          </h3>

          {/* Script embed */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-velox-text-muted">JavaScript Embed</label>
              <button
                onClick={() => copyToClipboard(embed.html, 'html')}
                className="flex items-center gap-1 text-[10px] text-velox-accent hover:underline"
              >
                {copiedField === 'html' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedField === 'html' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="bg-velox-bg rounded-lg p-3 text-xs font-mono text-velox-text-secondary overflow-x-auto whitespace-pre-wrap">
              {embed.html}
            </pre>
          </div>

          {/* Iframe embed */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-velox-text-muted">Iframe Embed</label>
              <button
                onClick={() => copyToClipboard(embed.scriptTag, 'iframe')}
                className="flex items-center gap-1 text-[10px] text-velox-accent hover:underline"
              >
                {copiedField === 'iframe' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedField === 'iframe' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="bg-velox-bg rounded-lg p-3 text-xs font-mono text-velox-text-secondary overflow-x-auto whitespace-pre-wrap">
              {embed.scriptTag}
            </pre>
          </div>

          {/* Direct URL */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-velox-text-muted">Direct URL</label>
              <button
                onClick={() => copyToClipboard(embed.iframeUrl, 'url')}
                className="flex items-center gap-1 text-[10px] text-velox-accent hover:underline"
              >
                {copiedField === 'url' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedField === 'url' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="bg-velox-bg rounded-lg px-3 py-2 text-xs font-mono text-velox-accent">
              {embed.iframeUrl}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Module Preview ──────────────────────────────────────────────────

function ModulePreview({ module: mod }: { module: ModuleConfig }) {
  const isDark = mod.styling.theme === 'dark';
  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const mutedColor = isDark ? 'text-gray-500' : 'text-gray-400';
  const bgCard = isDark ? 'bg-[#13131A]' : 'bg-gray-100';
  const borderColor = isDark ? 'border-gray-800' : 'border-gray-200';

  const placeholderCard = (idx: number) => (
    <div key={idx} className={cn('rounded-lg overflow-hidden border', borderColor, bgCard)}>
      <div className="aspect-video bg-gradient-to-br from-velox-accent/20 to-velox-accent/5 flex items-center justify-center">
        <Film className={cn('w-6 h-6', mutedColor)} />
      </div>
      {mod.styling.showTitle && (
        <div className="p-2.5">
          <div className={cn('text-xs font-medium', textColor)}>Video Title {idx + 1}</div>
          {mod.styling.showDuration && (
            <div className={cn('text-[10px] font-mono mt-0.5', mutedColor)}>3:24</div>
          )}
        </div>
      )}
    </div>
  );

  switch (mod.type) {
    case 'feature-video':
      return (
        <div className="max-w-lg mx-auto">
          <div className="aspect-video bg-gradient-to-br from-velox-accent/20 to-velox-accent/5 rounded-lg flex items-center justify-center mb-3">
            <PlayCircle className={cn('w-12 h-12', mutedColor)} />
          </div>
          {mod.styling.showTitle && <div className={cn('text-sm font-semibold', textColor)}>Featured Video Title</div>}
          {mod.styling.showDescription && <div className={cn('text-xs mt-1', mutedColor)}>Video description text goes here...</div>}
        </div>
      );

    case 'carousel':
      return (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: mod.styling.columns || 4 }).map((_, i) => (
            <div key={i} className="shrink-0 w-40">
              {placeholderCard(i)}
            </div>
          ))}
        </div>
      );

    case 'grid':
      return (
        <div className={cn('grid gap-3', `grid-cols-${mod.styling.columns || 3}`)}>
          {Array.from({ length: (mod.styling.columns || 3) * 2 }).map((_, i) => placeholderCard(i))}
        </div>
      );

    case 'playlist':
      return (
        <div className="flex gap-3">
          <div className="flex-1 aspect-video bg-gradient-to-br from-velox-accent/20 to-velox-accent/5 rounded-lg flex items-center justify-center">
            <PlayCircle className={cn('w-10 h-10', mutedColor)} />
          </div>
          <div className="w-48 space-y-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn('flex items-center gap-2 rounded p-1.5', bgCard)}>
                <div className="w-12 h-8 bg-velox-accent/10 rounded flex items-center justify-center shrink-0">
                  <Film className={cn('w-3 h-3', mutedColor)} />
                </div>
                <div className="min-w-0">
                  <div className={cn('text-[10px] truncate', textColor)}>Track {i + 1}</div>
                  <div className={cn('text-[9px] font-mono', mutedColor)}>2:30</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'video-article':
      return (
        <div className="flex gap-4">
          <div className="w-1/2 aspect-video bg-gradient-to-br from-velox-accent/20 to-velox-accent/5 rounded-lg flex items-center justify-center">
            <PlayCircle className={cn('w-8 h-8', mutedColor)} />
          </div>
          <div className="w-1/2 space-y-2">
            <div className={cn('text-sm font-semibold', textColor)}>Article Headline</div>
            <div className={cn('text-xs leading-relaxed', mutedColor)}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.
            </div>
          </div>
        </div>
      );

    case 'live-player':
      return (
        <div className="max-w-lg mx-auto">
          <div className="relative aspect-video bg-gradient-to-br from-red-500/20 to-red-500/5 rounded-lg flex items-center justify-center">
            <Radio className={cn('w-10 h-10', mutedColor)} />
            <span className="absolute top-2 left-2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-mono font-bold rounded uppercase">
              Live
            </span>
          </div>
          {mod.styling.showTitle && <div className={cn('text-sm font-semibold mt-2', textColor)}>Live Stream Title</div>}
        </div>
      );

    default:
      return <div className={cn('text-sm text-center py-8', mutedColor)}>Preview not available</div>;
  }
}
