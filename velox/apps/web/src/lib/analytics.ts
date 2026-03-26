/**
 * Google Analytics 4 event layer for video tracking.
 * Pushes events to the GA4 data layer with video metadata and custom dimensions.
 */

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

interface VideoEventParams {
  video_id: string;
  video_title: string;
  placement_id?: string;
  [key: string]: unknown;
}

function gtag(...args: unknown[]) {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag(...args);
  }
}

export function initGA() {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined') return;

  // Load GA4 script
  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.async = true;
  document.head.appendChild(script);

  // Initialize dataLayer
  (window as unknown as { dataLayer: unknown[] }).dataLayer = (window as unknown as { dataLayer?: unknown[] }).dataLayer || [];

  function gtagInit(...args: unknown[]) {
    (window as unknown as { dataLayer: unknown[] }).dataLayer.push(args);
  }

  (window as unknown as { gtag: typeof gtagInit }).gtag = gtagInit;
  gtagInit('js', new Date());
  gtagInit('config', GA_MEASUREMENT_ID);
}

export function trackVideoPlay(params: VideoEventParams) {
  gtag('event', 'video_play', params);
}

export function trackVideoPause(params: VideoEventParams) {
  gtag('event', 'video_pause', params);
}

export function trackVideoMilestone(params: VideoEventParams & { milestone: number }) {
  gtag('event', 'video_milestone', {
    ...params,
    milestone_percent: params.milestone,
  });
}

export function trackVideoComplete(params: VideoEventParams) {
  gtag('event', 'video_complete', params);
}

export function trackVideoSeek(params: VideoEventParams & { seek_to: number }) {
  gtag('event', 'video_seek', params);
}

/**
 * Build GA event params from video data, including any custom fields
 * that have sendToGA enabled in the metadata schema.
 */
export function buildGAParams(
  video: { id: string; title: string; customMetadata?: Record<string, unknown> },
  gaFields: Array<{ key: string }>,
  placementId?: string
): VideoEventParams {
  const params: VideoEventParams = {
    video_id: video.id,
    video_title: video.title,
  };

  if (placementId) {
    params.placement_id = placementId;
  }

  // Add custom dimensions from schema fields flagged for GA
  if (video.customMetadata) {
    for (const field of gaFields) {
      const value = video.customMetadata[field.key];
      if (value !== undefined && value !== null) {
        params[`custom_${field.key}`] = value;
      }
    }
  }

  return params;
}

/**
 * Creates a milestone tracker that fires at 25%, 50%, 75%, 100%.
 */
export function createMilestoneTracker(params: VideoEventParams) {
  const fired = new Set<number>();
  const milestones = [25, 50, 75, 100];

  return (currentTime: number, duration: number) => {
    if (duration <= 0) return;
    const percent = (currentTime / duration) * 100;

    for (const milestone of milestones) {
      if (percent >= milestone && !fired.has(milestone)) {
        fired.add(milestone);
        trackVideoMilestone({ ...params, milestone });
      }
    }
  };
}
