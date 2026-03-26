import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Save, Loader2, GripVertical, BarChart3, Tags,
  FileText, FolderOpen, ChevronRight, Settings2, Copy, Check,
  FileType, Regex, FolderTree, ArrowUpDown, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useSchema, useUpdateSchema } from '@/hooks/use-schema';
import { useFolderTree } from '@/hooks/use-folders';
import {
  useTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate,
} from '@/hooks/use-templates';
import { cn } from '@/lib/cn';
import type {
  CustomFieldDefinition, CustomFieldType, MetadataTemplate,
  TemplateMatchRule, MatchRuleType,
} from '@velox/shared';

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'select', label: 'Select' },
  { value: 'multi-select', label: 'Multi-Select' },
  { value: 'url', label: 'URL' },
];

const MATCH_RULE_TYPES: { value: MatchRuleType; label: string; icon: React.ReactNode; placeholder: string }[] = [
  { value: 'filename_pattern', label: 'Filename Pattern', icon: <Regex className="w-3.5 h-3.5" />, placeholder: 'e.g. PROMO_*, *.mxf, NEWS_2024*' },
  { value: 'folder', label: 'Exact Folder', icon: <FolderOpen className="w-3.5 h-3.5" />, placeholder: 'Select or paste folder ID' },
  { value: 'subfolder', label: 'Folder & Subfolders', icon: <FolderTree className="w-3.5 h-3.5" />, placeholder: 'All videos in this folder tree' },
  { value: 'extension', label: 'File Extension', icon: <FileType className="w-3.5 h-3.5" />, placeholder: 'e.g. .mxf, .mov, .mp4' },
];

type ActiveTab = 'fields' | 'templates';

export function MetadataPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('fields');

  return (
    <div>
      <PageHeader
        title="Metadata Manager"
        description="Define metadata fields, create templates, and set auto-assignment rules"
      />

      {/* Tab bar */}
      <div className="flex gap-1 bg-velox-surface rounded-lg p-1 border border-velox-border mb-6 w-fit">
        <button
          onClick={() => setActiveTab('fields')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors',
            activeTab === 'fields'
              ? 'bg-velox-accent/10 text-velox-accent'
              : 'text-velox-text-muted hover:text-velox-text-secondary'
          )}
        >
          <Tags className="w-4 h-4" />
          Fields
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors',
            activeTab === 'templates'
              ? 'bg-velox-accent/10 text-velox-accent'
              : 'text-velox-text-muted hover:text-velox-text-secondary'
          )}
        >
          <FileText className="w-4 h-4" />
          Templates & Rules
        </button>
      </div>

      {activeTab === 'fields' && <FieldsPanel />}
      {activeTab === 'templates' && <TemplatesPanel />}
    </div>
  );
}

// ── Fields Panel ────────────────────────────────────────────────────

function FieldsPanel() {
  const { data, isLoading } = useSchema();
  const updateSchema = useUpdateSchema();
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data?.data?.fields) {
      setFields(data.data.fields);
      setHasChanges(false);
    }
  }, [data]);

  const updateField = (index: number, updates: Partial<CustomFieldDefinition>) => {
    setFields((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      if (updates.label && !next[index].key) {
        next[index].key = updates.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      }
      return next;
    });
    setHasChanges(true);
  };

  const addField = () => {
    setFields((prev) => [...prev, { key: '', label: '', type: 'text', required: false, sendToGA: false }]);
    setHasChanges(true);
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleSave = async () => {
    for (const field of fields) {
      if (!field.key || !field.label) {
        alert('All fields must have a key and label');
        return;
      }
    }
    await updateSchema.mutateAsync(fields);
    setHasChanges(false);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-velox-accent animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Custom Metadata Fields</h3>
          <p className="text-xs text-velox-text-muted mt-0.5">
            Global field definitions available across all templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={updateSchema.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-velox-accent text-velox-bg text-xs font-medium rounded-lg hover:bg-velox-accent-hover transition-colors disabled:opacity-50"
            >
              {updateSchema.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Fields
            </button>
          )}
          <button
            onClick={addField}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-velox-surface-hover text-velox-text-secondary text-xs font-medium rounded-lg border border-velox-border hover:border-velox-border-light transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Field
          </button>
        </div>
      </div>

      {fields.length === 0 ? (
        <div className="bg-velox-surface rounded-xl border border-velox-border p-8 text-center">
          <Tags className="w-8 h-8 text-velox-text-muted mx-auto mb-2" />
          <p className="text-sm text-velox-text-muted">No custom fields defined yet</p>
          <button onClick={addField} className="mt-3 text-xs text-velox-accent hover:underline">
            Add your first field
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={index} className="bg-velox-surface rounded-xl border border-velox-border p-4">
              <div className="flex items-start gap-3">
                <GripVertical className="w-4 h-4 text-velox-text-muted mt-2.5 shrink-0 cursor-grab" />
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-velox-text-muted uppercase mb-1">Label</label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                      className="w-full bg-velox-bg border border-velox-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-velox-accent"
                      placeholder="Field label"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-velox-text-muted uppercase mb-1">Key</label>
                    <input
                      type="text"
                      value={field.key}
                      onChange={(e) => updateField(index, { key: e.target.value })}
                      className="w-full bg-velox-bg border border-velox-border rounded px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:border-velox-accent"
                      placeholder="field_key"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-velox-text-muted uppercase mb-1">Type</label>
                    <select
                      value={field.type}
                      onChange={(e) => updateField(index, { type: e.target.value as CustomFieldType })}
                      className="w-full bg-velox-bg border border-velox-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-velox-accent"
                    >
                      {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-velox-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(index, { required: e.target.checked })}
                        className="rounded border-velox-border"
                      />
                      Required
                    </label>
                    <label className={cn(
                      'flex items-center gap-1.5 text-xs cursor-pointer',
                      field.sendToGA ? 'text-velox-accent' : 'text-velox-text-secondary'
                    )}>
                      <input
                        type="checkbox"
                        checked={field.sendToGA}
                        onChange={(e) => updateField(index, { sendToGA: e.target.checked })}
                        className="rounded border-velox-border"
                      />
                      <BarChart3 className="w-3.5 h-3.5" /> GA
                    </label>
                    <button onClick={() => removeField(index)} className="p-1.5 text-velox-text-muted hover:text-velox-red transition-colors ml-auto">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              {(field.type === 'select' || field.type === 'multi-select') && (
                <div className="mt-3 ml-7">
                  <label className="block text-[10px] font-mono text-velox-text-muted uppercase mb-1">Options (comma-separated)</label>
                  <input
                    type="text"
                    value={(field.options || []).join(', ')}
                    onChange={(e) => updateField(index, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                    className="w-full bg-velox-bg border border-velox-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-velox-accent"
                    placeholder="Option 1, Option 2, Option 3"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Templates Panel ─────────────────────────────────────────────────

function TemplatesPanel() {
  const { data: templateData } = useTemplates();
  const { data: schemaData } = useSchema();
  const createTemplate = useCreateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  const templates = templateData?.data || [];
  const allFields = schemaData?.data?.fields || [];

  const handleCreate = async () => {
    if (!newName) return;
    const result = await createTemplate.mutateAsync({
      name: newName,
      fieldKeys: allFields.map((f) => f.key),
    });
    setSelectedId(result.data?.id);
    setShowNew(false);
    setNewName('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await deleteTemplate.mutateAsync(id);
    if (selectedId === id) setSelectedId(undefined);
  };

  return (
    <div className="flex gap-6">
      {/* Left — template list */}
      <div className="w-72 shrink-0 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Templates</h3>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-velox-accent text-velox-bg text-xs rounded hover:bg-velox-accent-hover transition-colors"
          >
            <Plus className="w-3 h-3" />
            New
          </button>
        </div>

        {showNew && (
          <div className="bg-velox-surface rounded-xl border border-velox-accent/30 p-3 space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Template name"
              className="w-full bg-velox-bg border border-velox-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-velox-accent"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex gap-2">
              <button onClick={handleCreate} className="flex-1 px-2 py-1 bg-velox-accent text-velox-bg text-xs rounded hover:bg-velox-accent-hover">Create</button>
              <button onClick={() => setShowNew(false)} className="flex-1 px-2 py-1 text-xs text-velox-text-muted">Cancel</button>
            </div>
          </div>
        )}

        {templates.map((tmpl) => (
          <button
            key={tmpl.id}
            onClick={() => setSelectedId(tmpl.id)}
            className={cn(
              'w-full text-left bg-velox-surface rounded-xl border p-3 transition-colors',
              selectedId === tmpl.id ? 'border-velox-accent/50' : 'border-velox-border hover:border-velox-border-light'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium truncate">{tmpl.name}</span>
              <ChevronRight className="w-4 h-4 text-velox-text-muted shrink-0" />
            </div>
            <div className="flex items-center gap-2 text-[10px] text-velox-text-muted">
              <span>{tmpl.fieldKeys.length} fields</span>
              <span>·</span>
              <span>{tmpl.matchRules.length} rules</span>
              <span className="ml-auto">
                {tmpl.enabled ? (
                  <span className="text-velox-green">Active</span>
                ) : (
                  <span className="text-velox-text-muted">Disabled</span>
                )}
              </span>
            </div>
            {tmpl.description && (
              <div className="text-[10px] text-velox-text-muted mt-1 truncate">{tmpl.description}</div>
            )}
          </button>
        ))}

        {templates.length === 0 && !showNew && (
          <div className="text-center py-8 text-xs text-velox-text-muted">
            No templates yet. Create one to group fields and set matching rules.
          </div>
        )}
      </div>

      {/* Right — template editor */}
      <div className="flex-1 min-w-0">
        {selectedId ? (
          <TemplateEditor
            id={selectedId}
            allFields={allFields}
            onDelete={() => { handleDelete(selectedId); }}
          />
        ) : (
          <div className="bg-velox-surface rounded-xl border border-velox-border p-12 text-center">
            <FileText className="w-10 h-10 text-velox-text-muted mx-auto mb-3" />
            <p className="text-sm text-velox-text-secondary">Select a template to configure fields and matching rules</p>
            <p className="text-xs text-velox-text-muted mt-2">
              Templates let you group metadata fields and auto-apply them based on filename patterns, folders, and file types
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Template Editor ─────────────────────────────────────────────────

function TemplateEditor({ id, allFields, onDelete }: {
  id: string;
  allFields: CustomFieldDefinition[];
  onDelete: () => void;
}) {
  const { data: templateData } = useTemplates();
  const updateTemplate = useUpdateTemplate();
  const { data: folderData } = useFolderTree();

  const template = templateData?.data?.find((t) => t.id === id);
  const folders = folderData?.data || [];

  if (!template) return null;

  const handleUpdate = (updates: Partial<MetadataTemplate>) => {
    updateTemplate.mutate({ id, ...updates });
  };

  const toggleField = (key: string) => {
    const keys = template.fieldKeys.includes(key)
      ? template.fieldKeys.filter((k) => k !== key)
      : [...template.fieldKeys, key];
    handleUpdate({ fieldKeys: keys });
  };

  const selectAllFields = () => {
    handleUpdate({ fieldKeys: allFields.map((f) => f.key) });
  };

  const clearAllFields = () => {
    handleUpdate({ fieldKeys: [] });
  };

  // ── Match Rules ───────────────────────────────────────────────

  const addRule = (type: MatchRuleType) => {
    const newRule: TemplateMatchRule = { type, value: '' };
    handleUpdate({ matchRules: [...template.matchRules, newRule] });
  };

  const updateRule = (index: number, updates: Partial<TemplateMatchRule>) => {
    const rules = [...template.matchRules];
    rules[index] = { ...rules[index], ...updates };
    handleUpdate({ matchRules: rules });
  };

  const removeRule = (index: number) => {
    handleUpdate({ matchRules: template.matchRules.filter((_, i) => i !== index) });
  };

  // ── Default Values ────────────────────────────────────────────

  const updateDefault = (key: string, value: unknown) => {
    handleUpdate({ defaultValues: { ...template.defaultValues, [key]: value } });
  };

  const selectedFields = allFields.filter((f) => template.fieldKeys.includes(f.key));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={template.name}
            onChange={(e) => handleUpdate({ name: e.target.value })}
            className="text-lg font-semibold bg-transparent border-none outline-none w-full"
          />
          <input
            type="text"
            value={template.description || ''}
            onChange={(e) => handleUpdate({ description: e.target.value })}
            placeholder="Add a description..."
            className="text-xs text-velox-text-muted bg-transparent border-none outline-none w-full mt-0.5"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleUpdate({ enabled: !template.enabled })}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors',
              template.enabled
                ? 'bg-velox-green/10 border-velox-green/30 text-velox-green'
                : 'bg-velox-surface border-velox-border text-velox-text-muted'
            )}
          >
            {template.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {template.enabled ? 'Active' : 'Disabled'}
          </button>
          <button onClick={onDelete} className="p-2 text-velox-text-muted hover:text-velox-red transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Priority */}
      <div className="bg-velox-surface rounded-xl border border-velox-border p-4">
        <div className="flex items-center gap-3">
          <ArrowUpDown className="w-4 h-4 text-velox-text-muted" />
          <div>
            <label className="text-xs font-mono text-velox-text-muted uppercase">Priority</label>
            <p className="text-[10px] text-velox-text-muted">Higher priority templates win when multiple match</p>
          </div>
          <input
            type="number"
            min="0"
            max="100"
            value={template.priority}
            onChange={(e) => handleUpdate({ priority: parseInt(e.target.value) || 0 })}
            className="ml-auto w-20 bg-velox-bg border border-velox-border rounded px-2.5 py-1.5 text-sm font-mono text-center focus:outline-none focus:border-velox-accent"
          />
        </div>
      </div>

      {/* Field Selection */}
      <div className="bg-velox-surface rounded-xl border border-velox-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider flex items-center gap-2">
            <Tags className="w-3.5 h-3.5" />
            Included Fields ({template.fieldKeys.length} / {allFields.length})
          </h3>
          <div className="flex gap-2">
            <button onClick={selectAllFields} className="text-[10px] text-velox-accent hover:underline">Select All</button>
            <button onClick={clearAllFields} className="text-[10px] text-velox-text-muted hover:underline">Clear</button>
          </div>
        </div>

        {allFields.length === 0 ? (
          <p className="text-xs text-velox-text-muted text-center py-4">
            No fields defined yet. Create fields in the "Fields" tab first.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {allFields.map((field) => {
              const isSelected = template.fieldKeys.includes(field.key);
              return (
                <button
                  key={field.key}
                  onClick={() => toggleField(field.key)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left border transition-colors',
                    isSelected
                      ? 'bg-velox-accent/5 border-velox-accent/30 text-velox-accent'
                      : 'bg-velox-bg border-velox-border text-velox-text-muted hover:text-velox-text-secondary hover:border-velox-border-light'
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0',
                    isSelected ? 'bg-velox-accent border-velox-accent text-velox-bg' : 'border-velox-border'
                  )}>
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{field.label}</div>
                    <div className="text-[9px] font-mono text-velox-text-muted">{field.key} · {field.type}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Default Values */}
      {selectedFields.length > 0 && (
        <div className="bg-velox-surface rounded-xl border border-velox-border p-4 space-y-3">
          <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5" />
            Default Values
          </h3>
          <p className="text-[10px] text-velox-text-muted">
            Pre-fill values when this template is applied to a video
          </p>
          <div className="space-y-2">
            {selectedFields.map((field) => (
              <div key={field.key} className="flex items-center gap-3">
                <label className="w-32 text-xs text-velox-text-secondary truncate shrink-0">{field.label}</label>
                <DefaultValueInput
                  field={field}
                  value={template.defaultValues[field.key]}
                  onChange={(val) => updateDefault(field.key, val)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Match Rules */}
      <div className="bg-velox-surface rounded-xl border border-velox-border p-4 space-y-3">
        <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider flex items-center gap-2">
          <Regex className="w-3.5 h-3.5" />
          Auto-Match Rules
        </h3>
        <p className="text-[10px] text-velox-text-muted">
          All rules must match for the template to be applied (AND logic). Videos are checked against all enabled templates — highest priority wins.
        </p>

        {template.matchRules.length > 0 && (
          <div className="space-y-2">
            {template.matchRules.map((rule, idx) => {
              const ruleType = MATCH_RULE_TYPES.find((r) => r.value === rule.type);
              return (
                <div key={idx} className="flex items-center gap-2 bg-velox-bg rounded-lg p-2.5 border border-velox-border">
                  <span className="text-velox-accent shrink-0">{ruleType?.icon}</span>
                  <span className="text-[10px] font-mono text-velox-text-muted uppercase w-28 shrink-0">
                    {ruleType?.label}
                  </span>
                  {(rule.type === 'folder' || rule.type === 'subfolder') ? (
                    <select
                      value={rule.value}
                      onChange={(e) => updateRule(idx, { value: e.target.value })}
                      className="flex-1 bg-velox-surface border border-velox-border rounded px-2 py-1 text-xs focus:outline-none focus:border-velox-accent"
                    >
                      <option value="">Select folder...</option>
                      {folders.map((f: any) => (
                        <option key={f.id} value={f.id}>
                          {'  '.repeat(f.depth || 0)}{f.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={rule.value}
                      onChange={(e) => updateRule(idx, { value: e.target.value })}
                      placeholder={ruleType?.placeholder}
                      className="flex-1 bg-velox-surface border border-velox-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-velox-accent"
                    />
                  )}
                  <button
                    onClick={() => removeRule(idx)}
                    className="p-1 text-velox-text-muted hover:text-velox-red transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add rule buttons */}
        <div className="flex flex-wrap gap-2">
          {MATCH_RULE_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => addRule(type.value)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] bg-velox-bg border border-velox-border rounded-lg text-velox-text-muted hover:text-velox-text-secondary hover:border-velox-border-light transition-colors"
            >
              {type.icon}
              + {type.label}
            </button>
          ))}
        </div>

        {template.matchRules.length > 0 && (
          <div className="bg-velox-bg rounded-lg p-3 border border-dashed border-velox-border">
            <div className="text-[10px] font-mono text-velox-text-muted uppercase mb-1">Rule Preview</div>
            <p className="text-xs text-velox-text-secondary">
              {template.matchRules.map((rule, i) => {
                const prefix = i > 0 ? ' AND ' : '';
                switch (rule.type) {
                  case 'filename_pattern': return `${prefix}filename matches "${rule.value || '...'}"`;
                  case 'folder': return `${prefix}in folder "${rule.value || '...'}"`;
                  case 'subfolder': return `${prefix}in folder or subfolder of "${rule.value || '...'}"`;
                  case 'extension': return `${prefix}file extension is "${rule.value || '...'}"`;
                  default: return '';
                }
              }).join('')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Default Value Input ─────────────────────────────────────────────

function DefaultValueInput({ field, value, onChange }: {
  field: CustomFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const cls = "flex-1 bg-velox-bg border border-velox-border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-velox-accent";

  switch (field.type) {
    case 'text':
    case 'url':
      return (
        <input
          type={field.type === 'url' ? 'url' : 'text'}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Default ${field.label.toLowerCase()}`}
          className={cn(cls, 'font-mono')}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
          className={cn(cls, 'font-mono w-32')}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          className={cn(cls, 'w-40')}
        />
      );

    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="accent-velox-accent"
          />
          <span className="text-xs text-velox-text-secondary">{value ? 'Yes' : 'No'}</span>
        </label>
      );

    case 'select':
      return (
        <select
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        >
          <option value="">No default</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case 'multi-select':
      return (
        <div className="flex flex-wrap gap-1 flex-1">
          {(field.options || []).map((opt) => {
            const selected = Array.isArray(value) && (value as string[]).includes(opt);
            return (
              <button
                key={opt}
                onClick={() => {
                  const current = Array.isArray(value) ? (value as string[]) : [];
                  onChange(selected ? current.filter((v) => v !== opt) : [...current, opt]);
                }}
                className={cn(
                  'px-2 py-0.5 text-[10px] rounded border transition-colors',
                  selected
                    ? 'bg-velox-accent/10 border-velox-accent/30 text-velox-accent'
                    : 'border-velox-border text-velox-text-muted hover:text-velox-text-secondary'
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>
      );

    default:
      return <span className="text-xs text-velox-text-muted">—</span>;
  }
}
