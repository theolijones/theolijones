import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';

interface BitmovinPlayerProps {
  sourceUrl: string;
  captionsUrl?: string;
  thumbnailSpriteUrl?: string;
  poster?: string;
  autoPlay?: boolean;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onComplete?: () => void;
  onTimeUpdate?: (time: number, duration: number) => void;
  onSeekRef?: MutableRefObject<((time: number) => void) | null>;
  className?: string;
}

export function BitmovinPlayer({
  sourceUrl,
  captionsUrl,
  poster,
  autoPlay = false,
  onReady,
  onPlay,
  onPause,
  onComplete,
  onTimeUpdate,
  onSeekRef,
  className,
}: BitmovinPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<unknown>(null);
  const destroyRef = useRef(false);

  const setupPlayer = useCallback(async () => {
    if (!containerRef.current || destroyRef.current) return;

    try {
      const { Player, PlayerEvent } = await import('bitmovin-player');

      if (destroyRef.current) return;

      const playerConfig = {
        key: '4578c6b5-0415-4969-babb-2ade8182e493',
        playback: {
          autoplay: autoPlay,
          muted: false,
        },
        ui: false,
        adaptation: {
          desktop: { preload: true },
        },
      };

      const player = new Player(containerRef.current, playerConfig);
      playerRef.current = player;

      // Expose seek function via ref
      if (onSeekRef) {
        onSeekRef.current = (time: number) => {
          player.seek(time);
        };
      }

      // Bind events
      player.on(PlayerEvent.Ready, () => onReady?.());
      player.on(PlayerEvent.Play, () => onPlay?.());
      player.on(PlayerEvent.Paused, () => onPause?.());
      player.on(PlayerEvent.PlaybackFinished, () => onComplete?.());
      player.on(PlayerEvent.TimeChanged, () => {
        onTimeUpdate?.(player.getCurrentTime(), player.getDuration());
      });

      // Load source
      await player.load({
        hls: sourceUrl,
        poster,
      });

      // Load captions sidecar if available — default enabled
      if (captionsUrl) {
        player.subtitles.add({
          id: 'captions-en',
          lang: 'en',
          label: 'English',
          url: captionsUrl,
          kind: 'subtitle',
        });
        // Enable captions by default
        try {
          player.subtitles.enable('captions-en');
        } catch {
          // Subtitle enabling may fail if track not yet loaded
        }
      }
    } catch (err) {
      console.warn('[BitmovinPlayer] Failed to initialize:', err);
    }
  }, [sourceUrl, captionsUrl, poster, autoPlay, onReady, onPlay, onPause, onComplete, onTimeUpdate, onSeekRef]);

  useEffect(() => {
    destroyRef.current = false;
    setupPlayer();

    return () => {
      destroyRef.current = true;
      if (onSeekRef) {
        onSeekRef.current = null;
      }
      if (playerRef.current) {
        try {
          (playerRef.current as { destroy: () => void }).destroy();
        } catch {
          // Player may already be destroyed
        }
        playerRef.current = null;
      }
    };
  }, [setupPlayer, onSeekRef]);

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="w-full aspect-video bg-black rounded-lg overflow-hidden"
      />
    </div>
  );
}

// Fallback player for when Bitmovin SDK is not available
export function FallbackPlayer({
  sourceUrl,
  captionsUrl,
  poster,
  onTimeUpdate,
  onSeekRef,
  className,
}: Pick<BitmovinPlayerProps, 'sourceUrl' | 'captionsUrl' | 'poster' | 'onTimeUpdate' | 'onSeekRef' | 'className'>) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (onSeekRef) {
      onSeekRef.current = (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      };
    }
    return () => {
      if (onSeekRef) onSeekRef.current = null;
    };
  }, [onSeekRef]);

  return (
    <div className={className}>
      <video
        ref={videoRef}
        controls
        poster={poster}
        className="w-full aspect-video bg-black rounded-lg"
        onTimeUpdate={() => {
          if (videoRef.current) {
            onTimeUpdate?.(videoRef.current.currentTime, videoRef.current.duration);
          }
        }}
      >
        <source src={sourceUrl} type="application/x-mpegURL" />
        {captionsUrl && (
          <track kind="subtitles" src={captionsUrl} srcLang="en" label="English" default />
        )}
      </video>
    </div>
  );
}
