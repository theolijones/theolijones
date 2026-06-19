import type { SchemaField } from "./schema";
import { sportByKey } from "../data/contentMappings";

// A form value for one input field. Catalog selects store their emitted key
// (sport → sport key, competition → competition string, tipType → UUID).
export type FieldValue = string | number | boolean | Date | null | undefined;

export interface AccountTalent {
  talentId?: string;
  talentInitials?: string;
}

/** Format a Date as naive local "YYYY-MM-DDTHH:MM:SS" (no timezone), matching the spec. */
export const formatEventDate = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
};

export const effectiveControl = (f: SchemaField): SchemaField["control"] => {
  if (f.control) return f.control;
  if (f.type === "enum") return "select";
  if (f.type === "number") return "number";
  if (f.type === "boolean") return "boolean";
  return "text";
};

/** Input fields the app should render (source=input and exposed). */
export const exposedInputFields = (fields: SchemaField[]): SchemaField[] =>
  fields.filter((f) => (f.source ?? "input") === "input" && f.exposed !== false);

/** The selected sport key — value of the input field whose catalog is "sport". */
const selectedSportKey = (
  fields: SchemaField[],
  values: Record<string, FieldValue>
): string | undefined => {
  const sportField = fields.find(
    (f) => (f.source ?? "input") === "input" && f.catalog === "sport"
  );
  const v = sportField ? values[sportField.key] : undefined;
  return typeof v === "string" && v ? v : undefined;
};

/** Required exposed inputs that are still empty. */
export const missingRequired = (
  fields: SchemaField[],
  values: Record<string, FieldValue>
): SchemaField[] =>
  exposedInputFields(fields).filter((f) => {
    if (!f.required) return false;
    if (effectiveControl(f) === "boolean") return false;
    const v = values[f.key];
    return v === undefined || v === null || v === "";
  });

/**
 * Assemble the video metadata JSON from the schema, the talent's input values,
 * and the account talent. Fixed fields emit their constant, derived fields are
 * computed from the account, and input fields take the entered/selected value.
 */
export const buildVideoMetadata = (
  fields: SchemaField[],
  values: Record<string, FieldValue>,
  account: AccountTalent
): Record<string, unknown> => {
  const sportKey = selectedSportKey(fields, values);
  const out: Record<string, unknown> = {};

  for (const f of fields) {
    const source = f.source ?? "input";

    if (source === "fixed") {
      out[f.key] = f.fixedValue;
      continue;
    }

    if (source === "derived") {
      if (f.derived === "talentOrShowList") {
        out[f.key] = account.talentId ? [account.talentId] : [];
      } else if (f.derived === "genericContentType") {
        const sport = sportKey ? sportByKey(sportKey) : undefined;
        out[f.key] =
          sport && account.talentInitials
            ? `${sport.genericPrefix}_FEED_${account.talentInitials}`
            : "";
      }
      continue;
    }

    // input
    const raw = values[f.key];
    const control = effectiveControl(f);

    if (control === "boolean") {
      out[f.key] = Boolean(raw);
      continue;
    }
    if (raw === null || raw === undefined || raw === "") {
      continue; // omit empty optional inputs
    }
    if (control === "number") {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (Number.isFinite(n)) out[f.key] = n;
    } else if (control === "date") {
      out[f.key] = raw instanceof Date ? formatEventDate(raw) : String(raw);
    } else if (control === "select" && f.catalog === "sport") {
      out[f.key] = sportByKey(String(raw))?.sportsClass ?? String(raw);
    } else {
      out[f.key] = raw; // text, competition/tipType/static select
    }
  }

  return out;
};
