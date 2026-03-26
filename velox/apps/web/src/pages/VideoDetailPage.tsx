import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Trash2, Send, ExternalLink } from 'lucide-react';
import { useVideo, useUpdateVideo, useDeleteVideo, usePublishVideo } from '@/hooks/use-videos';
import { BitmovinPlayer, FallbackPlayer } from '@/components/player/BitmovinPlayer';
import { MetadataForm } from '@/components/videos/MetadataForm';
import { StatusChip } from '@/components/ui/StatusChip';
import type { UpdateVideoInput } from '@velox/shared';
import { useState } from 'react';

export function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useVideo(id);
  const updateVideo = useUpdateVideo();
  const deleteVideo = useDeleteVideo();
  const publishVideo = usePublishVideo();
  const [activeTab, setActiveTab] = useState<'metadata' | 'transcript'>('metadata');

  const video = data?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-velox-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="text-center py-20">
        <p className="text-velox-text-secondary">Video not found</p>
        <Link to="/" className="text-velox-accent text-sm mt-2 inline-block hover:underline">
          Back to library
        </Link>
      </div>
    );
  }

  const handleSave = async (input: UpdateVideoInput) => {
    await updateVideo.mutateAsync({ id: video.id, ...input });
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${video.title}"? This cannot be undone.`)) return;
    await deleteVideo.mutateAsync(video.id);
    navigate('/');
  };

  const handlePublish = async () => {
    if (!confirm(`Publish "${video.title}"?`)) return;
    await publishVideo.mutateAsync(video.id);
  };

  const PlayerComponent = video.playbackUrl ? BitmovinPlayer : FallbackPlayer;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/"
          className="p-2 text-velox-text-muted hover:text-velox-text-primary bg-velox-surface border border-velox-border rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{video.title}</h1>
          <div className="flex items-center gap-3 mt-1">
            <StatusChip status={video.status} />
            <span className="text-xs text-velox-text-muted font-mono">{video.id}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {video.status !== 'published' && video.status !== 'uploading' && video.status !== 'processing' && (
            <button
              onClick={handlePublish}
              className="flex items-center gap-2 px-3 py-2 bg-velox-green-muted text-velox-green text-sm font-medium rounded-lg hover:bg-velox-green/20 transition-colors"
            >
              <Send className="w-4 h-4" />
              Publish
            </button>
          )}
          {video.playbackUrl && (
            <a
              href={video.playbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-velox-text-muted hover:text-velox-text-primary bg-velox-surface border border-velox-border rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={handleDelete}
            className="p-2 text-velox-text-muted hover:text-velox-red bg-velox-surface border border-velox-border rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Player */}
        <div className="lg:col-span-2">
          {video.playbackUrl ? (
            <PlayerComponent
              sourceUrl={video.playbackUrl}
              captionsUrl={video.captionUrl}
              poster={video.thumbnailUrl}
            />
          ) : (
            <div className="aspect-video bg-velox-surface rounded-xl border border-velox-border flex items-center justify-center">
              <div className="text-center">
                {video.status === 'uploading' || video.status === 'processing' ? (
                  <>
                    <div className="animate-spin w-8 h-8 border-2 border-velox-accent border-t-transparent rounded-full mx-auto mb-3" />
                    <p className="text-sm text-velox-text-secondary">
                      {video.status === 'uploading' ? 'Upload in progress...' : 'Transcoding in progress...'}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-velox-text-muted">No playback available</p>
                )}
              </div>
            </div>
          )}

          {/* Tabs below player */}
          <div className="mt-4">
            <div className="flex items-center gap-4 border-b border-velox-border">
              {(['metadata', 'transcript'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-velox-accent text-velox-accent'
                      : 'border-transparent text-velox-text-muted hover:text-velox-text-secondary'
                  }`}
                >
                  {tab === 'metadata' ? 'Metadata' : 'Transcript'}
                </button>
              ))}
            </div>

            <div className="mt-4 lg:hidden">
              {activeTab === 'metadata' && (
                <MetadataForm
                  video={video}
                  onSave={handleSave}
                  isSaving={updateVideo.isPending}
                />
              )}
              {activeTab === 'transcript' && (
                <div className="bg-velox-surface rounded-xl border border-velox-border p-6 text-center">
                  <p className="text-sm text-velox-text-secondary">
                    Transcript viewer — coming in Phase 3
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar — metadata form (desktop) */}
        <div className="hidden lg:block">
          <div className="bg-velox-surface rounded-xl border border-velox-border p-4">
            <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider mb-4">
              Video Metadata
            </h3>
            <MetadataForm
              video={video}
              onSave={handleSave}
              isSaving={updateVideo.isPending}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
