import { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { useSchema } from '@/hooks/use-schema';
import type { Video, UpdateVideoInput, CustomFieldDefinition } from '@velox/shared';

interface MetadataFormProps {
  video: Video;
  onSave: (data: UpdateVideoInput) => Promise<void>;
  isSaving: boolean;
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomFieldDefinition;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  switch (field.type) {
    case 'text':
    case 'url':
      return (
        <input
          type={field.type === 'url' ? 'url' : 'text'}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm text-velox-text-primary focus:outline-none focus:border-velox-accent"
          placeholder={field.type === 'url' ? 'https://...' : ''}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          className="w-full bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm text-velox-text-primary focus:outline-none focus:border-velox-accent"
        />
      );
    case 'date':
      return (
        <input
          type="date"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm text-velox-text-primary focus:outline-none focus:border-velox-accent"
        />
      );
    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-velox-border"
          />
          <span className="text-sm text-velox-text-secondary">
            {value ? 'Yes' : 'No'}
          </span>
        </label>
      );
    case 'select':
      return (
        <select
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="w-full bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm text-velox-text-primary focus:outline-none focus:border-velox-accent"
        >
          <option value="">Select...</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    case 'multi-select': {
      const selected = (value as string[]) || [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {field.options?.map((opt) => {
            const isSelected = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(
                    isSelected
                      ? selected.filter((s) => s !== opt)
                      : [...selected, opt]
                  );
                }}
                className={`px-2 py-0.5 text-[11px] font-mono rounded-full border transition-colors ${
                  isSelected
                    ? 'bg-velox-accent-muted text-velox-accent border-velox-accent/30'
                    : 'bg-velox-bg text-velox-text-muted border-velox-border hover:border-velox-border-light'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      );
    }
    default:
      return null;
  }
}

export function MetadataForm({ video, onSave, isSaving }: MetadataFormProps) {
  const { data: schemaData } = useSchema();
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description);
  const [category, setCategory] = useState(video.category);
  const [tagsInput, setTagsInput] = useState(video.tags.join(', '));
  const [customMetadata, setCustomMetadata] = useState<Record<string, unknown>>(
    video.customMetadata || {}
  );

  const customFields = schemaData?.data?.fields || [];

  useEffect(() => {
    setTitle(video.title);
    setDescription(video.description);
    setCategory(video.category);
    setTagsInput(video.tags.join(', '));
    setCustomMetadata(video.customMetadata || {});
  }, [video]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      title,
      description,
      category,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      customMetadata,
    });
  };

  const isDirty =
    title !== video.title ||
    description !== video.description ||
    category !== video.category ||
    tagsInput !== video.tags.join(', ') ||
    JSON.stringify(customMetadata) !== JSON.stringify(video.customMetadata || {});

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-mono text-velox-text-muted mb-1.5 uppercase tracking-wider">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm text-velox-text-primary focus:outline-none focus:border-velox-accent"
        />
      </div>

      <div>
        <label className="block text-xs font-mono text-velox-text-muted mb-1.5 uppercase tracking-wider">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm text-velox-text-primary focus:outline-none focus:border-velox-accent resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-mono text-velox-text-muted mb-1.5 uppercase tracking-wider">
          Category
        </label>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm text-velox-text-primary focus:outline-none focus:border-velox-accent"
          placeholder="e.g. Sport, News, Entertainment"
        />
      </div>

      <div>
        <label className="block text-xs font-mono text-velox-text-muted mb-1.5 uppercase tracking-wider">
          Tags
        </label>
        <input
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          className="w-full bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm text-velox-text-primary focus:outline-none focus:border-velox-accent"
          placeholder="Comma-separated tags"
        />
        {tagsInput && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tagsInput.split(',').map((t) => t.trim()).filter(Boolean).map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 bg-velox-accent-muted text-velox-accent text-[11px] font-mono rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Custom metadata fields from schema */}
      {customFields.length > 0 && (
        <div className="pt-4 border-t border-velox-border space-y-4">
          <h4 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider">
            Custom Fields
          </h4>
          {customFields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-mono text-velox-text-muted mb-1.5 uppercase tracking-wider">
                {field.label}
                {field.required && <span className="text-velox-red ml-1">*</span>}
                {field.sendToGA && (
                  <span className="text-velox-accent ml-1 normal-case" title="Sent to GA">GA</span>
                )}
              </label>
              <CustomFieldInput
                field={field}
                value={customMetadata[field.key]}
                onChange={(val) =>
                  setCustomMetadata((prev) => ({ ...prev, [field.key]: val }))
                }
              />
            </div>
          ))}
        </div>
      )}

      {/* Read-only file info */}
      <div className="pt-4 border-t border-velox-border space-y-3">
        <h4 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider">
          File Info
        </h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-velox-text-muted text-xs">Resolution</span>
            <p className="font-mono text-velox-text-secondary">{video.resolution || '—'}</p>
          </div>
          <div>
            <span className="text-velox-text-muted text-xs">Duration</span>
            <p className="font-mono text-velox-text-secondary">
              {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : '—'}
            </p>
          </div>
          <div>
            <span className="text-velox-text-muted text-xs">File Size</span>
            <p className="font-mono text-velox-text-secondary">
              {video.fileSize ? `${(video.fileSize / (1024 * 1024)).toFixed(1)} MB` : '—'}
            </p>
          </div>
          <div>
            <span className="text-velox-text-muted text-xs">Uploaded</span>
            <p className="font-mono text-velox-text-secondary">
              {new Date(video.uploadedAt).toLocaleDateString('en-AU')}
            </p>
          </div>
        </div>
      </div>

      {isDirty && (
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-velox-accent text-velox-bg text-sm font-medium rounded-lg hover:bg-velox-accent-hover transition-colors disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      )}
    </form>
  );
}
