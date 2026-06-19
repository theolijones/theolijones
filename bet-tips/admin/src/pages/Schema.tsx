import { useEffect, useState } from "react";
import { api } from "../api/client";

type FieldType = "string" | "number" | "boolean" | "enum";
type FieldSource = "fixed" | "input" | "derived";
type FieldControl = "text" | "number" | "boolean" | "date" | "select";
type FieldCatalog = "sport" | "competition" | "tipType";
type FieldDerivation = "talentOrShowList" | "genericContentType";

interface Field {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  helpText?: string;
  source?: FieldSource;
  fixedValue?: string | number | boolean;
  control?: FieldControl;
  catalog?: FieldCatalog;
  exposed?: boolean;
  derived?: FieldDerivation;
}

interface Schema {
  schemaId: "current";
  fields: Field[];
  updatedAt: string;
  updatedBy: string;
}

const blank = (): Field => ({
  key: "",
  label: "",
  type: "string",
  required: false,
  source: "input",
  control: "text",
  exposed: true,
});

const Schema = () => {
  const [fields, setFields] = useState<Field[]>([]);
  const [meta, setMeta] = useState<{ updatedAt: string; updatedBy: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const s = await api<Schema>("/admin/schema");
      setFields(s.fields);
      setMeta({ updatedAt: s.updatedAt, updatedBy: s.updatedBy });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateField = (i: number, patch: Partial<Field>) => {
    setFields(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };

  const removeField = (i: number) => setFields(fields.filter((_, idx) => idx !== i));

  const addField = () => setFields([...fields, blank()]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    setFields(next);
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      const cleaned = fields.map((f) => {
        const source = f.source ?? "input";
        const common = {
          key: f.key.trim(),
          label: f.label,
          type: f.type,
          required: f.required,
          helpText: f.helpText,
          source,
        };
        if (source === "fixed") {
          return { ...common, fixedValue: f.fixedValue };
        }
        if (source === "derived") {
          return { ...common, derived: f.derived };
        }
        const isSelect = f.control === "select" || f.type === "enum";
        return {
          ...common,
          control: f.control ?? "text",
          exposed: f.exposed !== false,
          catalog: isSelect ? f.catalog : undefined,
          options:
            isSelect && !f.catalog
              ? (f.options ?? []).map((o) => o.trim()).filter(Boolean)
              : undefined,
        };
      });
      const s = await api<Schema>("/admin/schema", {
        method: "PUT",
        body: { fields: cleaned },
      });
      setFields(s.fields);
      setMeta({ updatedAt: s.updatedAt, updatedBy: s.updatedBy });
      setOk("Schema saved.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="card muted">Loading…</div>;

  return (
    <div>
      <div className="toolbar">
        <h2>Metadata Schema</h2>
        <div className="row">
          <button className="secondary" onClick={addField}>+ Add field</button>
          <button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Defines the JSON fields written as each upload's sidecar metadata file.
          <b> Fixed</b> fields are constants; <b>input</b> fields are filled in by the
          talent (when exposed); <b>derived</b> fields are computed from the account's
          assigned talent.
        </p>
        {meta && (
          <div className="muted" style={{ fontSize: 12 }}>
            Last updated {new Date(meta.updatedAt).toLocaleString()} by {meta.updatedBy}
          </div>
        )}
      </div>

      <div className="card">
        <div className="field-row muted" style={{ fontSize: 11, textTransform: "uppercase" }}>
          <div>Key</div>
          <div>Label</div>
          <div>Type</div>
          <div>Required</div>
          <div></div>
        </div>
        {fields.map((f, i) => {
          const source = f.source ?? "input";
          const isSelect = f.control === "select" || f.type === "enum";
          return (
            <div key={i} style={{ borderBottom: "1px solid var(--border, #2a2a2a)", paddingBottom: 8, marginBottom: 8 }}>
              <div className="field-row">
                <input
                  placeholder="FeedTipId"
                  value={f.key}
                  onChange={(e) => updateField(i, { key: e.target.value })}
                />
                <input
                  placeholder="Bet ID"
                  value={f.label}
                  onChange={(e) => updateField(i, { label: e.target.value })}
                />
                <select
                  value={f.type}
                  onChange={(e) => updateField(i, { type: e.target.value as FieldType })}
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                  <option value="enum">enum</option>
                </select>
                <label style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) => updateField(i, { required: e.target.checked })}
                    style={{ width: "auto" }}
                  />
                </label>
                <div className="row">
                  <button className="secondary" onClick={() => move(i, -1)}>↑</button>
                  <button className="secondary" onClick={() => move(i, 1)}>↓</button>
                  <button className="danger" onClick={() => removeField(i)}>×</button>
                </div>
              </div>

              <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 6, alignItems: "center" }}>
                <span className="muted" style={{ fontSize: 11 }}>Source</span>
                <select
                  value={source}
                  onChange={(e) => updateField(i, { source: e.target.value as FieldSource })}
                >
                  <option value="fixed">fixed</option>
                  <option value="input">input</option>
                  <option value="derived">derived</option>
                </select>

                {source === "fixed" && (
                  <>
                    <span className="muted" style={{ fontSize: 11 }}>Value</span>
                    {f.type === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={Boolean(f.fixedValue)}
                        onChange={(e) => updateField(i, { fixedValue: e.target.checked })}
                        style={{ width: "auto" }}
                      />
                    ) : f.type === "number" ? (
                      <input
                        type="number"
                        value={f.fixedValue === undefined ? "" : String(f.fixedValue)}
                        onChange={(e) => updateField(i, { fixedValue: Number(e.target.value) })}
                        style={{ width: 120 }}
                      />
                    ) : (
                      <input
                        placeholder="Bulletin"
                        value={f.fixedValue === undefined ? "" : String(f.fixedValue)}
                        onChange={(e) => updateField(i, { fixedValue: e.target.value })}
                      />
                    )}
                  </>
                )}

                {source === "input" && (
                  <>
                    <span className="muted" style={{ fontSize: 11 }}>Control</span>
                    <select
                      value={f.control ?? "text"}
                      onChange={(e) => updateField(i, { control: e.target.value as FieldControl })}
                    >
                      <option value="text">text</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                      <option value="date">date</option>
                      <option value="select">select</option>
                    </select>
                    <label style={{ margin: 0, fontSize: 11 }} className="muted">
                      <input
                        type="checkbox"
                        checked={f.exposed !== false}
                        onChange={(e) => updateField(i, { exposed: e.target.checked })}
                        style={{ width: "auto", marginRight: 4 }}
                      />
                      Exposed in app
                    </label>
                    {isSelect && (
                      <>
                        <span className="muted" style={{ fontSize: 11 }}>Catalog</span>
                        <select
                          value={f.catalog ?? ""}
                          onChange={(e) =>
                            updateField(i, { catalog: (e.target.value || undefined) as FieldCatalog | undefined })
                          }
                        >
                          <option value="">(static options)</option>
                          <option value="sport">sport</option>
                          <option value="competition">competition</option>
                          <option value="tipType">tipType</option>
                        </select>
                        {!f.catalog && (
                          <input
                            placeholder="Comma-separated options"
                            value={(f.options ?? []).join(",")}
                            onChange={(e) => updateField(i, { options: e.target.value.split(",") })}
                          />
                        )}
                      </>
                    )}
                  </>
                )}

                {source === "derived" && (
                  <>
                    <span className="muted" style={{ fontSize: 11 }}>Derived</span>
                    <select
                      value={f.derived ?? ""}
                      onChange={(e) => updateField(i, { derived: e.target.value as FieldDerivation })}
                    >
                      <option value="">— select —</option>
                      <option value="talentOrShowList">talentOrShowList</option>
                      <option value="genericContentType">genericContentType</option>
                    </select>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {fields.length === 0 && <div className="muted">No fields yet.</div>}

        {err && <div className="error">{err}</div>}
        {ok && <div style={{ color: "var(--success)", marginTop: 8 }}>{ok}</div>}
      </div>
    </div>
  );
};

export default Schema;
