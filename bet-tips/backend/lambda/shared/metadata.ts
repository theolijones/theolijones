import type { NamedTemplate } from "./db";

/** Key of the Bet ID field inside a template's metadata JSON. The app writes
 *  the talent's entered Bet ID into this key at submit time. */
export const BET_ID_FIELD_KEY = "FeedTipId";

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Name a downloaded video after its Bet ID — the one value that is unique per
 * submission (TipType is fixed by the template, so it would collide across every
 * video made from it). Keeps the source extension, since uploads are a mix of
 * .mp4 and .mov. Falls back to the S3 key's basename when the Bet ID is missing.
 * Kept in sync with `videoFilename` in the admin app.
 */
export const downloadFilename = (
  metadata: Record<string, unknown> | undefined,
  key: string
): string => {
  const base = key.split("/").pop()?.trim() || "video.mp4";
  const betId = metadata?.[BET_ID_FIELD_KEY];
  if (typeof betId !== "string" && typeof betId !== "number") return base;
  const safe = String(betId).trim().replace(/[^\w.-]+/g, "_");
  if (!safe) return base;
  const ext = base.includes(".") ? base.slice(base.lastIndexOf(".")) : ".mp4";
  return `${safe}${ext}`;
};

/**
 * Validate and normalise an incoming array of named templates. Throws an Error
 * (message safe to surface as a 400) on any structural problem. Names are
 * trimmed and must be non-empty and unique (case-insensitive); `metadata` must
 * be a non-empty JSON object and is stored verbatim.
 */
export const parseNamedTemplates = (input: unknown): NamedTemplate[] => {
  if (!Array.isArray(input)) throw new Error("templates must be an array");
  const seen = new Set<string>();
  return input.map((raw, i) => {
    if (!isPlainObject(raw)) throw new Error(`template ${i} must be an object`);
    const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : undefined;
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) throw new Error(`template ${i} needs a name`);
    const key = name.toLowerCase();
    if (seen.has(key)) throw new Error(`duplicate template name "${name}"`);
    seen.add(key);
    if (!isPlainObject(raw.metadata)) {
      throw new Error(`template "${name}" metadata must be a JSON object`);
    }
    if (Object.keys(raw.metadata).length === 0) {
      throw new Error(`template "${name}" metadata is empty`);
    }
    return {
      // A stable id keeps React keys and future references sane; mint one when
      // the client didn't supply it (new template).
      id: id ?? `tpl_${Date.now().toString(36)}_${i}`,
      name,
      metadata: raw.metadata,
    };
  });
};
