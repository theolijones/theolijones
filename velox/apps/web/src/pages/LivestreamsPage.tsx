import { useState } from 'react';
import { Plus, Play, Square, Trash2, Copy, Radio, ArrowLeft, ExternalLink, Key, Clock } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusChip } from '@/components/ui/StatusChip';
import { BitmovinPlayer, FallbackPlayer } from '@/components/player/BitmovinPlayer';
import {
  useLivestreams, useLivestream, useCreateLivestream,
  useStartLivestream, useStopLivestream, useDeleteLivestream,
} from '@/hooks/use-livestreams';
import { cn } from '@/lib/cn';
import type { IngestProtocol, StreamResolution, LatencyMode, SrtMode } from '@velox/shared';

export function LivestreamsPage() {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', resolution: '1080p' as StreamResolution,
    latencyMode: 'standard' as LatencyMode, ingestProtocol: 'rtmp' as IngestProtocol,
    srtPort: 9998, srtPassphrase: '', srtMode: 'listener' as SrtMode,
  });

  const { data: listData } = useLivestreams();
  const { data: streamData } = useLivestream(selectedId);
  const createStream = useCreateLivestream();
  const startStream = useStartLivestream();
  const stopStream = useStopLivestream();
  const deleteStream = useDeleteLivestream();

  const streams = listData?.data || [];
  const stream = streamData?.data;

  const handleCreate = async () => {
    const result = await createStream.mutateAsync(form);
    setSelectedId(result.data?.id);
    setShowNew(false);
    setForm({ ...form, name: '', description: '' });
  };

  const handleDelete = async () => {
    if (!selectedId || !confirm('Delete this stream?')) return;
    await deleteStream.mutateAsync(selectedId);
    setSelectedId(undefined);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Detail view
  if (stream) {
    const PlayerComponent = stream.hlsPlaybackUrl ? BitmovinPlayer : FallbackPlayer;

    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setSelectedId(undefined)} className="p-2 text-velox-text-muted hover:text-velox-text-primary bg-velox-surface border border-velox-border rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold">{stream.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <StatusChip status={stream.status} />
              <span className={cn(
                'text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border',
                stream.ingestProtocol === 'srt'
                  ? 'text-purple-400 border-purple-400/30 bg-purple-400/10'
                  : 'text-blue-400 border-blue-400/30 bg-blue-400/10'
              )}>
                {stream.ingestProtocol.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stream.status === 'idle' && (
              <button onClick={() => startStream.mutate(stream.id)} className="flex items-center gap-2 px-3 py-2 bg-velox-green-muted text-velox-green text-sm font-medium rounded-lg hover:bg-velox-green/20">
                <Play className="w-4 h-4" /> Start
              </button>
            )}
            {stream.status === 'live' && (
              <button onClick={() => stopStream.mutate(stream.id)} className="flex items-center gap-2 px-3 py-2 bg-velox-red-muted text-velox-red text-sm font-medium rounded-lg hover:bg-velox-red/20">
                <Square className="w-4 h-4" /> Stop
              </button>
            )}
            <button onClick={handleDelete} className="p-2 text-velox-text-muted hover:text-velox-red bg-velox-surface border border-velox-border rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Preview player */}
          <div className="lg:col-span-2">
            {stream.hlsPlaybackUrl && stream.status === 'live' ? (
              <PlayerComponent sourceUrl={stream.hlsPlaybackUrl} />
            ) : (
              <div className="aspect-video bg-velox-surface rounded-xl border border-velox-border flex items-center justify-center">
                <div className="text-center">
                  <Radio className={cn('w-10 h-10 mx-auto mb-3', stream.status === 'live' ? 'text-velox-red animate-pulse' : 'text-velox-text-muted')} />
                  <p className="text-sm text-velox-text-secondary">
                    {stream.status === 'live' ? 'Stream is live' : 'Stream is offline'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Stream details sidebar */}
          <div className="space-y-4">
            {/* Ingest Credentials */}
            <div className="bg-velox-surface rounded-xl border border-velox-border p-4 space-y-3">
              <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider">Ingest Credentials</h3>

              {stream.ingestProtocol === 'rtmp' ? (
                <>
                  <div>
                    <span className="text-[10px] font-mono text-velox-text-muted uppercase">RTMP URL</span>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-xs bg-velox-bg rounded px-2 py-1.5 font-mono text-velox-text-secondary truncate">
                        {stream.ingestUrl}
                      </code>
                      <button onClick={() => copyToClipboard(stream.ingestUrl || '')} className="text-velox-text-muted hover:text-velox-accent">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-velox-text-muted uppercase">Stream Key</span>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-xs bg-velox-bg rounded px-2 py-1.5 font-mono text-velox-text-secondary truncate">
                        {stream.streamKey}
                      </code>
                      <button onClick={() => copyToClipboard(stream.streamKey || '')} className="text-velox-text-muted hover:text-velox-accent">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-[10px] font-mono text-velox-text-muted uppercase">SRT Endpoint</span>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-xs bg-velox-bg rounded px-2 py-1.5 font-mono text-velox-text-secondary truncate">
                        {stream.ingestUrl}
                      </code>
                      <button onClick={() => copyToClipboard(stream.ingestUrl || '')} className="text-velox-text-muted hover:text-velox-accent">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-mono text-velox-text-muted uppercase">Mode</span>
                      <p className="text-xs font-mono mt-1">{stream.srtMode}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-velox-text-muted uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3" />Latency
                      </span>
                      <p className="text-xs font-mono mt-1">{stream.srtLatency || 200}ms</p>
                    </div>
                  </div>
                  {stream.srtPassphrase && (
                    <div>
                      <span className="text-[10px] font-mono text-velox-text-muted uppercase flex items-center gap-1">
                        <Key className="w-3 h-3" />Passphrase
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 text-xs bg-velox-bg rounded px-2 py-1.5 font-mono text-velox-text-secondary">
                          ••••••••
                        </code>
                        <button onClick={() => copyToClipboard(stream.srtPassphrase || '')} className="text-velox-text-muted hover:text-velox-accent">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Output endpoints */}
            <div className="bg-velox-surface rounded-xl border border-velox-border p-4 space-y-3">
              <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider">Output Endpoints</h3>
              {stream.hlsPlaybackUrl && (
                <div>
                  <span className="text-[10px] font-mono text-velox-text-muted uppercase">HLS</span>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 text-xs bg-velox-bg rounded px-2 py-1.5 font-mono text-velox-text-secondary truncate">
                      {stream.hlsPlaybackUrl}
                    </code>
                    <button onClick={() => copyToClipboard(stream.hlsPlaybackUrl || '')} className="text-velox-text-muted hover:text-velox-accent">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
              {stream.dashPlaybackUrl && (
                <div>
                  <span className="text-[10px] font-mono text-velox-text-muted uppercase">DASH</span>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 text-xs bg-velox-bg rounded px-2 py-1.5 font-mono text-velox-text-secondary truncate">
                      {stream.dashPlaybackUrl}
                    </code>
                    <button onClick={() => copyToClipboard(stream.dashPlaybackUrl || '')} className="text-velox-text-muted hover:text-velox-accent">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="bg-velox-surface rounded-xl border border-velox-border p-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-velox-text-muted">Resolution</span><p className="font-mono mt-0.5">{stream.resolution}</p></div>
                <div><span className="text-velox-text-muted">Latency Mode</span><p className="font-mono mt-0.5">{stream.latencyMode}</p></div>
                <div><span className="text-velox-text-muted">Created</span><p className="font-mono mt-0.5">{new Date(stream.createdAt).toLocaleDateString('en-AU')}</p></div>
                <div><span className="text-velox-text-muted">VOD Recording</span><p className="font-mono mt-0.5">{stream.vodRecordingEnabled ? 'On' : 'Off'}</p></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div>
      <PageHeader
        title="Live Streams"
        description={`${streams.length} stream${streams.length !== 1 ? 's' : ''}`}
        actions={
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-velox-accent text-velox-bg text-sm font-medium rounded-lg hover:bg-velox-accent-hover transition-colors">
            <Plus className="w-4 h-4" /> New Livestream
          </button>
        }
      />

      {/* New stream form */}
      {showNew && (
        <div className="bg-velox-surface rounded-xl border border-velox-accent/30 p-5 mb-6 space-y-4">
          <h3 className="text-sm font-medium">Create New Livestream</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-mono text-velox-text-muted uppercase mb-1">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-velox-accent" placeholder="Stream name" />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-velox-text-muted uppercase mb-1">Protocol</label>
              <select value={form.ingestProtocol} onChange={(e) => setForm({ ...form, ingestProtocol: e.target.value as IngestProtocol })} className="w-full bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-velox-accent">
                <option value="rtmp">RTMP</option>
                <option value="srt">SRT</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-velox-text-muted uppercase mb-1">Resolution</label>
              <select value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value as StreamResolution })} className="w-full bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-velox-accent">
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="4k">4K</option>
              </select>
            </div>
          </div>
          {form.ingestProtocol === 'srt' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-mono text-velox-text-muted uppercase mb-1">SRT Port</label>
                <input type="number" value={form.srtPort} onChange={(e) => setForm({ ...form, srtPort: Number(e.target.value) })} className="w-full bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-velox-accent" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-velox-text-muted uppercase mb-1">Mode</label>
                <select value={form.srtMode} onChange={(e) => setForm({ ...form, srtMode: e.target.value as SrtMode })} className="w-full bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-velox-accent">
                  <option value="listener">Listener</option>
                  <option value="caller">Caller</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-velox-text-muted uppercase mb-1">Passphrase (optional)</label>
                <input type="password" value={form.srtPassphrase} onChange={(e) => setForm({ ...form, srtPassphrase: e.target.value })} className="w-full bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-velox-accent" />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!form.name || createStream.isPending} className="px-4 py-2 bg-velox-accent text-velox-bg text-sm font-medium rounded-lg hover:bg-velox-accent-hover disabled:opacity-50">
              {createStream.isPending ? 'Provisioning...' : 'Create Stream'}
            </button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-velox-text-muted hover:text-velox-text-primary">Cancel</button>
          </div>
        </div>
      )}

      {/* Stream cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {streams.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedId(s.id)}
            className="bg-velox-surface rounded-xl border border-velox-border p-4 text-left hover:border-velox-border-light transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <StatusChip status={s.status} />
              <span className={cn(
                'text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border',
                s.ingestProtocol === 'srt'
                  ? 'text-purple-400 border-purple-400/30 bg-purple-400/10'
                  : 'text-blue-400 border-blue-400/30 bg-blue-400/10'
              )}>
                {s.ingestProtocol.toUpperCase()}
              </span>
            </div>
            <h3 className="text-sm font-medium truncate">{s.name}</h3>
            <p className="text-xs text-velox-text-muted mt-1 font-mono">{s.resolution}</p>
          </button>
        ))}
      </div>

      {streams.length === 0 && !showNew && (
        <div className="bg-velox-surface rounded-xl border border-velox-border p-12 text-center">
          <Radio className="w-10 h-10 text-velox-text-muted mx-auto mb-3" />
          <p className="text-sm text-velox-text-secondary">No live streams configured</p>
        </div>
      )}
    </div>
  );
}
