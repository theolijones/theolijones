import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Loader2, GripVertical, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSchema, useUpdateSchema } from '@/hooks/use-schema';
import type { CustomFieldDefinition, CustomFieldType } from '@velox/shared';

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'select', label: 'Select' },
  { value: 'multi-select', label: 'Multi-Select' },
  { value: 'url', label: 'URL' },
];

function emptyField(): CustomFieldDefinition {
  return {
    key: '',
    label: '',
    type: 'text',
    required: false,
    sendToGA: false,
  };
}

export function SchemaEditor() {
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
      // Auto-generate key from label if key is empty
      if (updates.label && !next[index].key) {
        next[index].key = updates.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      }
      return next;
    });
    setHasChanges(true);
  };

  const addField = () => {
    setFields((prev) => [...prev, emptyField()]);
    setHasChanges(true);
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleSave = async () => {
    // Validate
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
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-velox-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Custom Metadata Fields</h3>
          <p className="text-xs text-velox-text-muted mt-0.5">
            Define custom fields that appear on all video detail pages
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={updateSchema.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-velox-accent text-velox-bg text-xs font-medium rounded-lg hover:bg-velox-accent-hover transition-colors disabled:opacity-50"
            >
              {updateSchema.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save Schema
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
        <div className="bg-velox-bg rounded-lg border border-velox-border p-8 text-center">
          <p className="text-sm text-velox-text-muted">No custom fields defined yet</p>
          <button
            onClick={addField}
            className="mt-3 text-xs text-velox-accent hover:underline"
          >
            Add your first field
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={index}
              className="bg-velox-bg rounded-lg border border-velox-border p-4"
            >
              <div className="flex items-start gap-3">
                <GripVertical className="w-4 h-4 text-velox-text-muted mt-2.5 shrink-0 cursor-grab" />

                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                  {/* Label */}
                  <div>
                    <label className="block text-[10px] font-mono text-velox-text-muted uppercase mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                      className="w-full bg-velox-surface border border-velox-border rounded px-2.5 py-1.5 text-sm text-velox-text-primary focus:outline-none focus:border-velox-accent"
                      placeholder="Field label"
                    />
                  </div>

                  {/* Key */}
                  <div>
                    <label className="block text-[10px] font-mono text-velox-text-muted uppercase mb-1">
                      Key
                    </label>
                    <input
                      type="text"
                      value={field.key}
                      onChange={(e) => updateField(index, { key: e.target.value })}
                      className="w-full bg-velox-surface border border-velox-border rounded px-2.5 py-1.5 text-sm font-mono text-velox-text-primary focus:outline-none focus:border-velox-accent"
                      placeholder="field_key"
                    />
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-[10px] font-mono text-velox-text-muted uppercase mb-1">
                      Type
                    </label>
                    <select
                      value={field.type}
                      onChange={(e) => updateField(index, { type: e.target.value as CustomFieldType })}
                      className="w-full bg-velox-surface border border-velox-border rounded px-2.5 py-1.5 text-sm text-velox-text-primary focus:outline-none focus:border-velox-accent"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Options row */}
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

                    <label
                      className={cn(
                        'flex items-center gap-1.5 text-xs cursor-pointer',
                        field.sendToGA ? 'text-velox-accent' : 'text-velox-text-secondary'
                      )}
                      title="Send to Google Analytics as custom dimension"
                    >
                      <input
                        type="checkbox"
                        checked={field.sendToGA}
                        onChange={(e) => updateField(index, { sendToGA: e.target.checked })}
                        className="rounded border-velox-border"
                      />
                      <BarChart3 className="w-3.5 h-3.5" />
                      GA
                    </label>

                    <button
                      onClick={() => removeField(index)}
                      className="p-1.5 text-velox-text-muted hover:text-velox-red transition-colors ml-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Options for select/multi-select */}
              {(field.type === 'select' || field.type === 'multi-select') && (
                <div className="mt-3 ml-7">
                  <label className="block text-[10px] font-mono text-velox-text-muted uppercase mb-1">
                    Options (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={(field.options || []).join(', ')}
                    onChange={(e) =>
                      updateField(index, {
                        options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className="w-full bg-velox-surface border border-velox-border rounded px-2.5 py-1.5 text-sm text-velox-text-primary focus:outline-none focus:border-velox-accent"
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
