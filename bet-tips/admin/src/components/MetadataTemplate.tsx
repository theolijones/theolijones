import {
  effectiveControl,
  optionsFor,
  templatableFields,
  templateSportKey,
  type SchemaField,
} from "../data/metadataFields";

interface Props {
  fields: SchemaField[];
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

/**
 * Editor for a token's metadata template — pre-set defaults for the app-input
 * fields. Values are stored in the same control representation the app form
 * uses (sport key, competition string, tipType id, text, boolean). Empty
 * selections are omitted so the talent just fills them in as normal.
 */
const MetadataTemplate = ({ fields, value, onChange }: Props) => {
  const editable = templatableFields(fields);
  const sportKey = templateSportKey(fields, value);

  const set = (field: SchemaField, raw: unknown) => {
    const next = { ...value };
    if (raw === "" || raw === null || raw === undefined) {
      delete next[field.key];
    } else {
      next[field.key] = raw;
    }
    // Changing the sport invalidates a previously-picked competition.
    if (field.catalog === "sport") {
      for (const f of editable) {
        if (f.catalog === "competition") delete next[f.key];
      }
    }
    onChange(next);
  };

  if (editable.length === 0) {
    return <div className="muted">No templatable fields in the current schema.</div>;
  }

  return (
    <div className="template-grid">
      {editable.map((f) => {
        const control = effectiveControl(f);
        const current = value[f.key];

        if (control === "boolean") {
          return (
            <label key={f.key} className="template-field">
              <span>{f.label}</span>
              <select
                value={current === true ? "true" : current === false ? "false" : ""}
                onChange={(e) =>
                  set(f, e.target.value === "" ? "" : e.target.value === "true")
                }
              >
                <option value="">— no default —</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
          );
        }

        if (control === "select") {
          const opts = optionsFor(f, sportKey);
          const disabled = f.catalog === "competition" && !sportKey;
          return (
            <label key={f.key} className="template-field">
              <span>{f.label}</span>
              <select
                value={typeof current === "string" ? current : ""}
                disabled={disabled}
                onChange={(e) => set(f, e.target.value)}
              >
                <option value="">
                  {disabled ? "— pick a sport first —" : "— no default —"}
                </option>
                {opts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        // text / number
        return (
          <label key={f.key} className="template-field">
            <span>{f.label}</span>
            <input
              type={control === "number" ? "number" : "text"}
              value={current === undefined || current === null ? "" : String(current)}
              placeholder={f.helpText ?? "No default"}
              onChange={(e) => {
                const v = e.target.value;
                if (control === "number") {
                  set(f, v === "" ? "" : Number(v));
                } else {
                  set(f, v);
                }
              }}
            />
          </label>
        );
      })}
    </div>
  );
};

export default MetadataTemplate;
