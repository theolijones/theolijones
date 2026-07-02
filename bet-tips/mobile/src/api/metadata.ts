// Key of the Bet ID field inside a template's metadata JSON. The app writes the
// talent's entered Bet ID into this key before uploading. Mirrors the backend.
export const BET_ID_FIELD_KEY = "FeedTipId";

/**
 * A named, admin-authored metadata template. `metadata` is a complete, fixed
 * COP metadata object; the only value filled at submit time is the Bet ID.
 */
export interface NamedTemplate {
  id: string;
  name: string;
  metadata: Record<string, unknown>;
}

/** Produce the final metadata JSON for an upload: the template's metadata with
 *  the entered Bet ID written into BET_ID_FIELD_KEY. */
export const applyBetId = (
  template: NamedTemplate,
  betId: string
): Record<string, unknown> => ({
  ...template.metadata,
  [BET_ID_FIELD_KEY]: betId,
});
