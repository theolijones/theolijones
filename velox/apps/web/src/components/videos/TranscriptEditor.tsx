import { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Loader2, AlertTriangle, Clock, Languages } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTranscript, useUpdateTranscript, type TranscriptSegment } from '@/hooks/use-transcript';

function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.95) return 'text-velox-green';
  if (confidence >= 0.8) return 'text-velox-amber';
  return 'text-velox-red';
}

interface TranscriptEditorProps {
  videoId: string;
  currentTime?: number;
  onSeek?: (time: number) => void;
}

export function TranscriptEditor({ videoId, currentTime = 0, onSeek }: TranscriptEditorProps) {
  const { data, isLoading, error } = useTranscript(videoId);
  const updateTranscript = useUpdateTranscript();
  const [editedSegments, setEditedSegments] = useState<TranscriptSegment[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [hasEdits, setHasEdits] = useState(false);
  const segmentRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollEnabled = useRef(true);

  const transcript = data?.data;

  useEffect(() => {
    if (transcript?.segments) {
      setEditedSegments(transcript.segments);
      setHasEdits(false);
    }
  }, [transcript]);

  // Auto-scroll to active segment
  useEffect(() => {
    if (!autoScrollEnabled.current || editingId !== null) return;

    const activeSegment = editedSegments.find(
      (s) => currentTime >= s.startTime && currentTime <= s.endTime
    );

    if (activeSegment) {
      const el = segmentRefs.current.get(activeSegment.id);
      if (el && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const isVisible =
          elRect.top >= containerRect.top && elRect.bottom <= containerRect.bottom;

        if (!isVisible) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [currentTime, editedSegments, editingId]);

  const handleTextChange = useCallback((segmentId: number, newText: string) => {
    setEditedSegments((prev) =>
      prev.map((s) => (s.id === segmentId ? { ...s, text: newText } : s))
    );
    setHasEdits(true);
  }, []);

  const handleSave = async () => {
    await updateTranscript.mutateAsync({ videoId, segments: editedSegments });
    setHasEdits(false);
    setEditingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-velox-accent animate-spin" />
      </div>
    );
  }

  if (error || !transcript) {
    return (
      <div className="bg-velox-surface rounded-xl border border-velox-border p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-velox-text-muted mx-auto mb-2" />
        <p className="text-sm text-velox-text-secondary">
          {transcript === undefined ? 'No transcript available yet' : 'Failed to load transcript'}
        </p>
        <p className="text-xs text-velox-text-muted mt-1">
          Transcription is generated automatically after video processing
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-velox-text-muted">
            <Languages className="w-3.5 h-3.5" />
            <span className="font-mono uppercase">{transcript.language}</span>
          </div>
          <span className="text-xs text-velox-text-muted">
            {editedSegments.length} segments
          </span>
        </div>
        {hasEdits && (
          <button
            onClick={handleSave}
            disabled={updateTranscript.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-velox-accent text-velox-bg text-xs font-medium rounded-lg hover:bg-velox-accent-hover transition-colors disabled:opacity-50"
          >
            {updateTranscript.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save Edits
          </button>
        )}
      </div>

      {/* Segments */}
      <div
        ref={containerRef}
        className="max-h-[500px] overflow-y-auto space-y-1 pr-1"
        onMouseEnter={() => { autoScrollEnabled.current = false; }}
        onMouseLeave={() => { autoScrollEnabled.current = true; }}
      >
        {editedSegments.map((segment) => {
          const isActive =
            currentTime >= segment.startTime && currentTime <= segment.endTime;
          const isEditing = editingId === segment.id;

          return (
            <div
              key={segment.id}
              ref={(el) => {
                if (el) segmentRefs.current.set(segment.id, el);
              }}
              className={cn(
                'flex gap-3 p-2 rounded-lg transition-colors cursor-pointer group',
                isActive
                  ? 'bg-velox-accent-muted border border-velox-accent/30'
                  : 'hover:bg-velox-surface-hover border border-transparent'
              )}
              onClick={() => {
                if (!isEditing) onSeek?.(segment.startTime);
              }}
            >
              {/* Timecode */}
              <button
                className="shrink-0 flex items-center gap-1 text-[11px] font-mono text-velox-text-muted hover:text-velox-accent transition-colors pt-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek?.(segment.startTime);
                }}
              >
                <Clock className="w-3 h-3" />
                {formatTimecode(segment.startTime)}
              </button>

              {/* Text */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <textarea
                    value={segment.text}
                    onChange={(e) => handleTextChange(segment.id, e.target.value)}
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                    className="w-full bg-velox-bg border border-velox-border rounded px-2 py-1 text-sm text-velox-text-primary focus:outline-none focus:border-velox-accent resize-none"
                    rows={2}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p
                    className={cn(
                      'text-sm leading-relaxed',
                      isActive ? 'text-velox-text-primary' : 'text-velox-text-secondary'
                    )}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingId(segment.id);
                    }}
                  >
                    {segment.text}
                  </p>
                )}
              </div>

              {/* Confidence */}
              <span
                className={cn(
                  'shrink-0 text-[10px] font-mono pt-0.5',
                  confidenceColor(segment.confidence)
                )}
                title={`Confidence: ${Math.round(segment.confidence * 100)}%`}
              >
                {Math.round(segment.confidence * 100)}%
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-velox-text-muted text-center">
        Double-click any segment to edit. Click timecode to seek.
      </p>
    </div>
  );
}
