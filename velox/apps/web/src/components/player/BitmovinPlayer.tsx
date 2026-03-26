import { useEffect, useRef, useCallback } from 'react';

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
  className,
}: BitmovinPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<unknown>(null);
  const destroyRef = useRef(false);

  const setupPlayer = useCallback(async () => {
    if (!containerRef.current || destroyRef.current) return;

    try {
      // Dynamic import for Bitmovin Player
      const { Player, PlayerEvent } = await import('bitmovin-player');

      if (destroyRef.current) return;

      const playerConfig = {
        key: '4578c6b5-0415-4969-babb-2ade8182e493',
        playback: {
          autoplay: autoPlay,
          muted: false,
        },
        ui: false, // We could add bitmovin-player-ui for a richer UI
        adaptation: {
          desktop: { preload: true },
        },
      };

      const player = new Player(containerRef.current, playerConfig);
      playerRef.current = player;

      // Bind events
      player.on(PlayerEvent.Ready, () => onReady?.());
      player.on(PlayerEvent.Play, () => onPlay?.());
      player.on(PlayerEvent.Paused, () => onPause?.());
      player.on(PlayerEvent.PlaybackFinished, () => onComplete?.());
      player.on(PlayerEvent.TimeChanged, () => {
        onTimeUpdate?.(player.getCurrentTime(), player.getDuration());
      });

      // Load source
      const sourceConfig: Record<string, unknown> = {
        hls: sourceUrl,
        poster,
      };

      await player.load(sourceConfig);

      // Load captions if available
      if (captionsUrl) {
        player.subtitles.add({
          id: 'captions',
          lang: 'en',
          label: 'English',
          url: captionsUrl,
          kind: 'subtitle',
        });
      }
    } catch (err) {
      console.warn('[BitmovinPlayer] Failed to initialize:', err);
    }
  }, [sourceUrl, captionsUrl, poster, autoPlay, onReady, onPlay, onPause, onComplete, onTimeUpdate]);

  useEffect(() => {
    destroyRef.current = false;
    setupPlayer();

    return () => {
      destroyRef.current = true;
      if (playerRef.current) {
        try {
          (playerRef.current as { destroy: () => void }).destroy();
        } catch {
          // Player may already be destroyed
        }
        playerRef.current = null;
      }
    };
  }, [setupPlayer]);

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
  className,
}: Pick<BitmovinPlayerProps, 'sourceUrl' | 'captionsUrl' | 'poster' | 'className'>) {
  return (
    <div className={className}>
      <video
        controls
        poster={poster}
        className="w-full aspect-video bg-black rounded-lg"
      >
        <source src={sourceUrl} type="application/x-mpegURL" />
        {captionsUrl && (
          <track kind="subtitles" src={captionsUrl} srcLang="en" label="English" default />
        )}
      </video>
    </div>
  );
}
