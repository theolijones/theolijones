// Shared metadata-schema field shape + helpers for the admin. Mirrors the
// mobile app's schema/metadata model so a token's metadata template is stored
// in the same control-value representation the app form uses (sport key,
// competition string, tipType id, text, boolean).
import { SPORTS, TIP_TYPES, sportByKey } from "./contentMappings";

export type FieldSource = "fixed" | "input" | "derived";
export type FieldControl = "text" | "number" | "boolean" | "date" | "select";
export type FieldCatalog = "sport" | "competition" | "tipType";

export interface SchemaField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "enum";
  required: boolean;
  options?: string[];
  helpText?: string;
  source?: FieldSource;
  fixedValue?: string | number | boolean;
  control?: FieldControl;
  catalog?: FieldCatalog;
  exposed?: boolean;
}

export interface Schema {
  schemaId: "current";
  fields: SchemaField[];
  updatedAt: string;
  updatedBy: string;
}

export type TemplateValue = string | number | boolean;

/** Schema key of the per-submission Bet ID — entered by the talent in the app,
 *  never part of an admin template. Mirrors the backend constant. */
export const BET_ID_FIELD_KEY = "FeedTipId";

/** A named, admin-authored metadata template attached to a user. */
export interface NamedTemplate {
  id: string;
  name: string;
  values: Record<string, unknown>;
}

export const effectiveControl = (f: SchemaField): FieldControl => {
  if (f.control) return f.control;
  if (f.type === "enum") return "select";
  if (f.type === "number") return "number";
  if (f.type === "boolean") return "boolean";
  return "text";
};

/**
 * Fields an admin sets in a template. The app-input fields, minus `date` (the
 * event date is per-tip) and the Bet ID (entered per-submission in the app).
 */
export const templatableFields = (fields: SchemaField[]): SchemaField[] =>
  fields.filter(
    (f) =>
      (f.source ?? "input") === "input" &&
      f.exposed !== false &&
      f.key !== BET_ID_FIELD_KEY &&
      effectiveControl(f) !== "date"
  );

export interface Option {
  label: string;
  value: string;
}

/** Options for a select field, mirroring the app. Competitions filter by sport. */
export const optionsFor = (f: SchemaField, sportKey?: string): Option[] => {
  if (f.catalog === "sport") return SPORTS.map((s) => ({ label: s.label, value: s.key }));
  if (f.catalog === "tipType") return TIP_TYPES.map((t) => ({ label: t.name, value: t.id }));
  if (f.catalog === "competition") {
    const comps = sportKey ? sportByKey(sportKey)?.competitions ?? [] : [];
    return comps.map((c) => ({ label: c, value: c }));
  }
  return (f.options ?? []).map((o) => ({ label: o, value: o }));
};

/** The current template's selected sport key (drives competition options). */
export const templateSportKey = (
  fields: SchemaField[],
  template: Record<string, unknown>
): string | undefined => {
  const sf = fields.find((f) => f.catalog === "sport");
  const v = sf ? template[sf.key] : undefined;
  return typeof v === "string" && v ? v : undefined;
};
