import { useState } from 'react';
import { Plus, Trash2, Settings2, Film, GripVertical, Calendar, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusChip } from '@/components/ui/StatusChip';
import {
  usePlacements,
  usePlacement,
  usePlacementVideos,
  useCreatePlacement,
  useUpdatePlacement,
  useDeletePlacement,
  useReorderPlacementVideos,
  usePlacementOverrides,
} from '@/hooks/use-placements';
import { cn } from '@/lib/cn';
import type { PlacementRule, PlacementRuleType, ModuleType } from '@velox/shared';

const MODULE_TYPES: { value: ModuleType; label: string }[] = [
  { value: 'feature-video', label: 'Feature Video' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'video-article', label: 'Video + Article' },
  { value: 'playlist', label: 'Playlist' },
  { value: 'live-player', label: 'Live Player' },
  { value: 'grid', label: 'Grid' },
];

const RULE_TYPES: { value: PlacementRuleType; label: string; placeholder: string }[] = [
  { value: 'folder', label: 'All videos in folder', placeholder: 'Folder ID' },
  { value: 'tag', label: 'Videos tagged with', placeholder: 'Tag name' },
  { value: 'recent', label: 'Published in last N days', placeholder: 'Number of days' },
  { value: 'manual', label: 'Manual video list', placeholder: 'Comma-separated video IDs' },
];

export function PlacementsPage() {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ModuleType>('carousel');

  const { data: listData } = usePlacements();
  const { data: placementData } = usePlacement(selectedId);
  const { data: videosData } = usePlacementVideos(selectedId);
  const { data: overridesData } = usePlacementOverrides(selectedId);
  const createPlacement = useCreatePlacement();
  const updatePlacement = useUpdatePlacement();
  const deletePlacement = useDeletePlacement();
  const reorderVideos = useReorderPlacementVideos();

  const placements = listData?.data || [];
  const placement = placementData?.data;
  const videos = videosData?.data?.videos || [];
  const overrides = overridesData?.data || [];

  const handleCreate = async () => {
    if (!newName) return;
    const result = await createPlacement.mutateAsync({ name: newName, type: newType });
    setSelectedId(result.data?.id);
    setShowNewForm(false);
    setNewName('');
  };

  const handleDelete = async () => {
    if (!selectedId || !confirm('Delete this placement?')) return;
    await deletePlacement.mutateAsync(selectedId);
    setSelectedId(undefined);
  };

  const handleAddRule = async () => {
    if (!placement) return;
    const newRule: PlacementRule = { type: 'tag', value: '' };
    await updatePlacement.mutateAsync({
      id: placement.id,
      rules: [...placement.rules, newRule],
    });
  };

  const handleUpdateRule = async (index: number, updates: Partial<PlacementRule>) => {
    if (!placement) return;
    const rules = [...placement.rules];
    rules[index] = { ...rules[index], ...updates };
    await updatePlacement.mutateAsync({ id: placement.id, rules });
  };

  const handleRemoveRule = async (index: number) => {
    if (!placement) return;
    const rules = placement.rules.filter((_, i) => i !== index);
    await updatePlacement.mutateAsync({ id: placement.id, rules });
  };

  return (
    <div>
      <PageHeader
        title="Placements"
        description="Configure video placements and content delivery targets"
        actions={
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-velox-accent text-velox-bg text-sm font-medium rounded-lg hover:bg-velox-accent-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Placement
          </button>
        }
      />

      <div className="flex gap-6">
        {/* Left panel — placement list */}
        <div className="w-64 shrink-0 space-y-2">
          {showNewForm && (
            <div className="bg-velox-surface rounded-xl border border-velox-accent/30 p-3 space-y-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Placement name"
                className="w-full bg-velox-bg border border-velox-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-velox-accent"
                autoFocus
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as ModuleType)}
                className="w-full bg-velox-bg border border-velox-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-velox-accent"
              >
                {MODULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={handleCreate} className="flex-1 px-2 py-1 bg-velox-accent text-velox-bg text-xs rounded hover:bg-velox-accent-hover">Create</button>
                <button onClick={() => setShowNewForm(false)} className="flex-1 px-2 py-1 text-xs text-velox-text-muted hover:text-velox-text-primary">Cancel</button>
              </div>
            </div>
          )}

          {placements.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={cn(
                'w-full text-left bg-velox-surface rounded-xl border p-3 transition-colors',
                selectedId === p.id ? 'border-velox-accent/50' : 'border-velox-border hover:border-velox-border-light'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate">{p.name}</span>
                <ChevronRight className="w-4 h-4 text-velox-text-muted shrink-0" />
              </div>
              <span className="text-[10px] font-mono text-velox-text-muted uppercase">{p.type}</span>
            </button>
          ))}

          {placements.length === 0 && !showNewForm && (
            <div className="text-center py-8 text-xs text-velox-text-muted">
              No placements yet
            </div>
          )}
        </div>

        {/* Right panel — placement detail */}
        <div className="flex-1 min-w-0">
          {placement ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{placement.name}</h2>
                  <span className="text-xs font-mono text-velox-text-muted uppercase">{placement.type}</span>
                </div>
                <button onClick={handleDelete} className="p-2 text-velox-text-muted hover:text-velox-red transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Rules */}
              <div className="bg-velox-surface rounded-xl border border-velox-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider">Content Rules</h3>
                  <button onClick={handleAddRule} className="text-xs text-velox-accent hover:underline">+ Add Rule</button>
                </div>
                {placement.rules.length === 0 ? (
                  <p className="text-sm text-velox-text-muted text-center py-4">No rules configured</p>
                ) : (
                  placement.rules.map((rule, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-velox-bg rounded-lg p-2.5">
                      <Settings2 className="w-4 h-4 text-velox-text-muted shrink-0" />
                      <select
                        value={rule.type}
                        onChange={(e) => handleUpdateRule(idx, { type: e.target.value as PlacementRuleType })}
                        className="bg-velox-surface border border-velox-border rounded px-2 py-1 text-xs focus:outline-none focus:border-velox-accent"
                      >
                        {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <input
                        type="text"
                        value={rule.value}
                        onChange={(e) => handleUpdateRule(idx, { value: e.target.value })}
                        placeholder={RULE_TYPES.find((t) => t.value === rule.type)?.placeholder}
                        className="flex-1 bg-velox-surface border border-velox-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-velox-accent"
                      />
                      <button onClick={() => handleRemoveRule(idx)} className="text-velox-text-muted hover:text-velox-red">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Content Preview */}
              <div className="bg-velox-surface rounded-xl border border-velox-border p-4 space-y-3">
                <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider">
                  Content Preview ({videos.length} videos)
                </h3>
                {videos.length === 0 ? (
                  <p className="text-sm text-velox-text-muted text-center py-4">
                    No videos match current rules
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {videos.map((video, idx) => (
                      <div key={video.id} className="flex items-center gap-3 bg-velox-bg rounded-lg p-2.5 group">
                        <GripVertical className="w-4 h-4 text-velox-text-muted cursor-grab shrink-0" />
                        <span className="text-[10px] font-mono text-velox-text-muted w-5">{idx + 1}</span>
                        <div className="w-16 h-9 bg-velox-border rounded overflow-hidden shrink-0">
                          {video.thumbnailUrl ? (
                            <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Film className="w-4 h-4 text-velox-text-muted" />
                            </div>
                          )}
                        </div>
                        <span className="text-sm truncate flex-1">{video.title}</span>
                        <StatusChip status={video.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Schedule Overrides */}
              <div className="bg-velox-surface rounded-xl border border-velox-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider">
                    <Calendar className="w-3.5 h-3.5 inline mr-1.5" />
                    Scheduled Overrides
                  </h3>
                </div>
                {overrides.length === 0 ? (
                  <p className="text-sm text-velox-text-muted text-center py-4">No scheduled overrides</p>
                ) : (
                  <div className="space-y-1.5">
                    {overrides.map((o) => (
                      <div key={o.id} className="flex items-center gap-3 bg-velox-bg rounded-lg p-2.5 text-xs">
                        <span className="font-mono text-velox-text-muted">{o.videoId.slice(0, 8)}...</span>
                        <span className="text-velox-accent">
                          {new Date(o.startAt).toLocaleDateString()} — {new Date(o.endAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-velox-surface rounded-xl border border-velox-border p-12 text-center">
              <Settings2 className="w-10 h-10 text-velox-text-muted mx-auto mb-3" />
              <p className="text-sm text-velox-text-secondary">Select a placement to configure</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
