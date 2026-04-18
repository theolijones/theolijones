import { useEffect, useState } from "react";
import { api } from "../api/client";

type FieldType = "string" | "number" | "boolean" | "enum";

interface Field {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  helpText?: string;
}

interface Schema {
  schemaId: "current";
  fields: Field[];
  updatedAt: string;
  updatedBy: string;
}

const blank = (): Field => ({ key: "", label: "", type: "string", required: false });

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
      const cleaned = fields.map((f) => ({
        ...f,
        options:
          f.type === "enum"
            ? (f.options ?? []).map((o) => o.trim()).filter(Boolean)
            : undefined,
      }));
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
          Defines the JSON fields each upload must include as its sidecar metadata file.
          Mobile clients fetch this schema at upload time and prompt the user accordingly.
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
        {fields.map((f, i) => (
          <div key={i}>
            <div className="field-row">
              <input
                placeholder="sportsbetUsername"
                value={f.key}
                onChange={(e) => updateField(i, { key: e.target.value })}
              />
              <input
                placeholder="Sportsbet Username"
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
            {f.type === "enum" && (
              <div style={{ marginBottom: 8 }}>
                <input
                  placeholder="Comma-separated options (e.g. Win,Place,EW)"
                  value={(f.options ?? []).join(",")}
                  onChange={(e) =>
                    updateField(i, { options: e.target.value.split(",") })
                  }
                />
              </div>
            )}
          </div>
        ))}
        {fields.length === 0 && <div className="muted">No fields yet.</div>}

        {err && <div className="error">{err}</div>}
        {ok && <div style={{ color: "var(--success)", marginTop: 8 }}>{ok}</div>}
      </div>
    </div>
  );
};

export default Schema;
