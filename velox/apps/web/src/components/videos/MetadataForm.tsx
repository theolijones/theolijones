import { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import type { Video, UpdateVideoInput } from '@velox/shared';

interface MetadataFormProps {
  video: Video;
  onSave: (data: UpdateVideoInput) => Promise<void>;
  isSaving: boolean;
}

export function MetadataForm({ video, onSave, isSaving }: MetadataFormProps) {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description);
  const [category, setCategory] = useState(video.category);
  const [tagsInput, setTagsInput] = useState(video.tags.join(', '));

  useEffect(() => {
    setTitle(video.title);
    setDescription(video.description);
    setCategory(video.category);
    setTagsInput(video.tags.join(', '));
  }, [video]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      title,
      description,
      category,
      tags: tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
  };

  const isDirty =
    title !== video.title ||
    description !== video.description ||
    category !== video.category ||
    tagsInput !== video.tags.join(', ');

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
          rows={4}
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
            {tagsInput
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
              .map((tag, i) => (
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

      {/* Read-only metadata */}
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
