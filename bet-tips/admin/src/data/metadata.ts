/**
 * The metadata key holding the Bet ID. A template is a complete, fixed JSON
 * uploaded by an admin; the talent enters only the Bet ID, which the mobile app
 * writes into this key before shipping the JSON verbatim with the video.
 *
 * Mirrors `backend/lambda/shared/metadata.ts` and `mobile/src/api/metadata.ts`.
 */
export const BET_ID_FIELD_KEY = "FeedTipId";


export type Metadata = Record<string, unknown>;

export const hasMetadata = (metadata?: Metadata): metadata is Metadata =>
  !!metadata && Object.keys(metadata).length > 0;

/**
 * Name the downloaded video after its Bet ID — the one value that is unique per
 * submission (TipType is fixed by the template, so it would collide across every
 * video made from it). Keeps the source extension, since uploads are a mix of
 * .mp4 and .mov. Falls back to the S3 key's basename when the Bet ID is missing.
 */
export const videoFilename = (metadata?: Metadata, videoKey?: string): string => {
  const base = videoKey?.split("/").pop()?.trim() || "video.mp4";
  const betId = metadata?.[BET_ID_FIELD_KEY];
  if (typeof betId !== "string" && typeof betId !== "number") return base;
  const safe = String(betId).trim().replace(/[^\w.-]+/g, "_");
  if (!safe) return base;
  const ext = base.includes(".") ? base.slice(base.lastIndexOf(".")) : ".mp4";
  return `${safe}${ext}`;
};

/** The sidecar sits alongside the video: `<video filename>.metadata`. */
export const sidecarFilename = (metadata?: Metadata, videoKey?: string): string =>
  `${videoFilename(metadata, videoKey)}.metadata`;

/** Serialize the stored metadata client-side and trigger a download. */
export const downloadMetadata = (metadata: Metadata, videoKey?: string): void => {
  const blob = new Blob([JSON.stringify(metadata, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = sidecarFilename(metadata, videoKey);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
