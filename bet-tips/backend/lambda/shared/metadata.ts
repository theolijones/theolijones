import type { NamedTemplate } from "./db";

/** Schema key of the per-submission Bet ID. Admin templates never set it; the
 *  app injects the talent's entered value into it at submit time. */
export const BET_ID_FIELD_KEY = "FeedTipId";

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Drop empty/null entries and the Bet ID key so we never persist meaningless
 *  or per-submission template values. */
export const cleanTemplateValues = (
  t: Record<string, unknown>
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(t)) {
    if (k === BET_ID_FIELD_KEY) continue;
    if (v === null || v === undefined || v === "") continue;
    out[k] = v;
  }
  return out;
};

/**
 * Validate and normalise an incoming array of named templates. Throws an Error
 * (message safe to surface as a 400) on any structural problem. Names are
 * trimmed and must be non-empty and unique (case-insensitive).
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
    if (!isPlainObject(raw.values)) throw new Error(`template "${name}" values must be an object`);
    return {
      // A stable id keeps React keys and future references sane; mint one when
      // the client didn't supply it (new template).
      id: id ?? `tpl_${Date.now().toString(36)}_${i}`,
      name,
      values: cleanTemplateValues(raw.values),
    };
  });
};
