import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import { BET_ID_FIELD_KEY } from "../data/metadata";
import { TALENTS, talentById } from "../data/talents";
import {
  type Option,
  GENERIC_CONTENT_TYPES,
  SPORTS_COMPETITIONS,
  SPORT_CLASSES,
  VIDEO_LOCATIONS,
  TRACK_NAMES,
  TIP_TYPES,
  ROUND_NUMBERS,
  optName,
  optId,
} from "../data/lookups";

interface NamedTemplate {
  id: string;
  name: string;
  metadata: Record<string, unknown>;
}

interface User {
  userId: string;
  sportsbetUsername?: string;
  email?: string;
  talentName?: string;
  talentInitials?: string;
  metadataTemplates: NamedTemplate[];
  createdAt: string;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `tpl_${crypto.randomUUID()}`
    : `tpl_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

// --- Field schema -----------------------------------------------------------
// The template metadata follows a known field set. Each field renders a purpose
// built control; unknown keys from an uploaded JSON fall back to a text row.

const TALENT_LIST_KEY = "TalentOrShowList";
const TIPPER_KEY = "TipperId"; // derived from the talents; never edited directly
// Keys we never render as editable rows (derived, or set elsewhere in the pipeline).
const HIDDEN_KEYS = new Set([TIPPER_KEY, "EventName", "DisplayFrom", "DisplayUntil"]);

const talentOptions: Option[] = TALENTS.map((t) => ({ name: t.name, id: t.id }));
const asOptions = (values: string[]): Option[] => values.map((v) => ({ name: v, id: v }));

type Control =
  | { kind: "locked" }
  | { kind: "text" }
  | { kind: "date" }
  | { kind: "datetime" }
  | { kind: "bool" }
  | { kind: "yesno" }
  | { kind: "range"; min: number; max: number }
  | { kind: "lookup"; options: Option[]; multi?: boolean };

interface FieldSpec {
  key: string;
  control: Control;
  def: unknown; // default value for a new template
}

type TemplateType = "racing" | "sport";

// Shared by both template types.
const COMMON_SPECS: FieldSpec[] = [
  { key: BET_ID_FIELD_KEY, control: { kind: "locked" }, def: "" },
  { key: TALENT_LIST_KEY, control: { kind: "lookup", options: talentOptions, multi: true }, def: [] },
  { key: "IsVertical", control: { kind: "bool" }, def: false },
  { key: "GenericContentType", control: { kind: "lookup", options: asOptions(GENERIC_CONTENT_TYPES) }, def: "" },
  { key: "EventDate", control: { kind: "date" }, def: "" },
  { key: "EventStartTime", control: { kind: "datetime" }, def: "" },
  { key: "ShowPreviewImage", control: { kind: "bool" }, def: true },
  { key: "IsAvailableOnPlatform", control: { kind: "yesno" }, def: "Yes" },
  { key: "ThirdPartyFlag", control: { kind: "bool" }, def: false },
  { key: "AssetClass", control: { kind: "text" }, def: "Bulletin" },
  { key: "VideoLocations", control: { kind: "lookup", options: VIDEO_LOCATIONS, multi: true }, def: [] },
  { key: "TipType", control: { kind: "lookup", options: TIP_TYPES }, def: "" },
];
const RACING_SPECS: FieldSpec[] = [
  { key: "RaceType", control: { kind: "text" }, def: "" },
  { key: "InternationalRace", control: { kind: "bool" }, def: false },
  { key: "TrackNames", control: { kind: "lookup", options: TRACK_NAMES, multi: true }, def: [] },
  { key: "RaceNumber", control: { kind: "range", min: 1, max: 13 }, def: "" },
];
const SPORT_SPECS: FieldSpec[] = [
  { key: "SportsCompetitionName", control: { kind: "lookup", options: asOptions(SPORTS_COMPETITIONS) }, def: "" },
  { key: "SportsClass", control: { kind: "lookup", options: asOptions(SPORT_CLASSES) }, def: "" },
  { key: "RoundNumber", control: { kind: "lookup", options: ROUND_NUMBERS }, def: "" },
];

const specsFor = (type: TemplateType): FieldSpec[] =>
  [...COMMON_SPECS, ...(type === "racing" ? RACING_SPECS : SPORT_SPECS)];
const ALL_SPEC_KEYS = new Set([...COMMON_SPECS, ...RACING_SPECS, ...SPORT_SPECS].map((s) => s.key));
const RACING_ONLY = RACING_SPECS.map((s) => s.key);
const SPORT_ONLY = SPORT_SPECS.map((s) => s.key);

// Templates don't carry a stored type, so infer it: RACING_* content types are
// racing; otherwise fall back to which specialised fields are present.
const inferType = (meta: Record<string, unknown>): TemplateType => {
  if (String(meta.GenericContentType ?? "").toUpperCase().startsWith("RACING")) return "racing";
  const hasSport = SPORT_ONLY.some((k) => k in meta);
  const hasRacing = RACING_ONLY.some((k) => k in meta);
  return hasRacing && !hasSport ? "racing" : "sport";
};

const defaultMetadata = (type: TemplateType): Record<string, unknown> => {
  const m: Record<string, unknown> = {};
  for (const s of specsFor(type)) m[s.key] = Array.isArray(s.def) ? [] : s.def;
  return m;
};

// Melbourne timezone offset for a wall-clock datetime (AEST +10:00 / AEDT +11:00),
// recomputed per date so daylight saving is handled automatically.
const melbourneOffset = (wall: string): string => {
  const m = wall.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return "+10:00";
  const asUTC = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Australia/Melbourne",
      timeZoneName: "longOffset",
    }).formatToParts(asUTC);
    const off = (parts.find((p) => p.type === "timeZoneName")?.value ?? "").replace("GMT", "").trim();
    return /^[+-]\d{2}:\d{2}$/.test(off) ? off : "+10:00";
  } catch {
    return "+10:00";
  }
};
const offsetLabel = (off: string): string =>
  off === "+11:00" ? "AEDT (+11:00)" : off === "+10:00" ? "AEST (+10:00)" : off || "";

// Build the metadata object from the working values: known fields in schema order,
// TipperId derived right after the talent list, then any extra unknown keys.
const buildMetadata = (
  values: Record<string, unknown>,
  extras: [string, unknown][],
  type: TemplateType
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const s of specsFor(type)) {
    out[s.key] = values[s.key];
    if (s.key === TALENT_LIST_KEY) {
      const ids = Array.isArray(values[TALENT_LIST_KEY]) ? (values[TALENT_LIST_KEY] as string[]) : [];
      out[TIPPER_KEY] = ids.map((id) => {
        const tip = talentById(String(id))?.tipperId;
        return tip ? tip : null;
      });
    }
  }
  for (const [k, v] of extras) out[k] = v;
  return out;
};

const Users = () => {
  const [list, setList] = useState<User[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<User | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const usersRes = await api<{ users: User[] }>("/admin/users");
      setList(usersRes.users);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <div className="toolbar">
        <h2>Users</h2>
      </div>

      <div className="card">
        {loading ? (
          <div className="muted">Loading…</div>
        ) : list.length === 0 ? (
          <div className="muted">No users yet. Issue a signup token and have a talent sign up.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Sportsbet username</th>
                <th>Talent</th>
                <th>Templates</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.userId}>
                  <td>{u.sportsbetUsername ?? u.email ?? u.userId}</td>
                  <td>{u.talentName ? `${u.talentName} (${u.talentInitials})` : "—"}</td>
                  <td className="muted">
                    {u.metadataTemplates.length
                      ? `${u.metadataTemplates.length} template${
                          u.metadataTemplates.length === 1 ? "" : "s"
                        }`
                      : "—"}
                  </td>
                  <td className="muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="secondary" onClick={() => setEditing(u)}>
                      Manage templates
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {err && <div className="error">{err}</div>}
      </div>

      {editing && (
        <TemplatesModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
};

interface ModalProps {
  user: User;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

const TemplatesModal = ({ user, onClose, onSaved }: ModalProps) => {
  const [templates, setTemplates] = useState<NamedTemplate[]>(
    user.metadataTemplates.map((t) => ({ ...t }))
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addTemplate = (type: TemplateType) =>
    setTemplates((prev) => [...prev, { id: newId(), name: "", metadata: defaultMetadata(type) }]);
  const updateTemplate = (id: string, patch: Partial<NamedTemplate>) =>
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const removeTemplate = (id: string) =>
    setTemplates((prev) => prev.filter((t) => t.id !== id));

  const save = async () => {
    const names = templates.map((t) => t.name.trim().toLowerCase());
    if (templates.some((t) => !t.name.trim())) {
      setErr("Every template needs a name.");
      return;
    }
    if (new Set(names).size !== names.length) {
      setErr("Template names must be unique.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api(`/admin/users/${user.userId}/templates`, {
        method: "PUT",
        body: {
          templates: templates.map((t) => ({
            id: t.id,
            name: t.name.trim(),
            metadata: t.metadata,
          })),
        },
      });
      await onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : (e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h3>
          Metadata templates —{" "}
          <span className="mono">{user.sportsbetUsername ?? user.userId}</span>
        </h3>
        <div className="muted" style={{ marginBottom: 16 }}>
          Each template is a fixed metadata JSON. In the app the talent picks one and enters a
          Bet ID, which is written into the <span className="mono">{BET_ID_FIELD_KEY}</span> field
          before the metadata is uploaded with the video.
        </div>

        {templates.length === 0 && (
          <div className="muted" style={{ marginBottom: 12 }}>
            No templates yet. Add one below.
          </div>
        )}

        {templates.map((t) => (
          <TemplateRow
            key={t.id}
            template={t}
            onChange={(patch) => updateTemplate(t.id, patch)}
            onRemove={() => removeTemplate(t.id)}
          />
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="secondary" onClick={() => addTemplate("sport")}>
            + Add sport template
          </button>
          <button className="secondary" onClick={() => addTemplate("racing")}>
            + Add racing template
          </button>
        </div>

        {err && <div className="error">{err}</div>}

        <div className="actions">
          <button className="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save templates"}
          </button>
        </div>
      </div>
    </div>
  );
};

interface RowProps {
  template: NamedTemplate;
  onChange: (patch: Partial<NamedTemplate>) => void;
  onRemove: () => void;
}

const TemplateRow = ({ template, onChange, onRemove }: RowProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const [type, setType] = useState<TemplateType>(() => inferType(template.metadata));
  // Working values: schema defaults overlaid with whatever the template has.
  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    ...defaultMetadata(inferType(template.metadata)),
    ...template.metadata,
  }));
  // Extra keys present in the metadata that aren't part of the known schema.
  const [extras, setExtras] = useState<[string, string][]>(() =>
    Object.entries(template.metadata)
      .filter(([k]) => !ALL_SPEC_KEYS.has(k) && !HIDDEN_KEYS.has(k))
      .map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])
  );
  const metaRef = useRef(template.metadata);

  useEffect(() => {
    if (template.metadata !== metaRef.current) {
      metaRef.current = template.metadata;
      const t = inferType(template.metadata);
      setType(t);
      setValues({ ...defaultMetadata(t), ...template.metadata });
      setExtras(
        Object.entries(template.metadata)
          .filter(([k]) => !ALL_SPEC_KEYS.has(k) && !HIDDEN_KEYS.has(k))
          .map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])
      );
    }
  }, [template.metadata]);

  const commit = (nextValues: Record<string, unknown>, nextExtras: [string, string][]) => {
    setValues(nextValues);
    setExtras(nextExtras);
    const extraParsed: [string, unknown][] = nextExtras
      .filter(([k]) => k.trim())
      .map(([k, v]) => {
        try {
          return [k.trim(), JSON.parse(v)];
        } catch {
          return [k.trim(), v];
        }
      });
    const meta = buildMetadata(nextValues, extraParsed, type);
    metaRef.current = meta;
    onChange({ metadata: meta });
  };
  const setValue = (key: string, v: unknown) => commit({ ...values, [key]: v }, extras);
  const setExtra = (i: number, patch: [string, string]) =>
    commit(values, extras.map((e, idx) => (idx === i ? patch : e)));
  const removeExtra = (i: number) => commit(values, extras.filter((_, idx) => idx !== i));
  const addExtra = () => commit(values, [...extras, ["", ""]]);

  const onFile = async (file: File | undefined) => {
    setFileErr(null);
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("JSON must be an object");
      }
      const obj = parsed as Record<string, unknown>;
      const t = inferType(obj);
      const nextValues = { ...defaultMetadata(t) };
      for (const s of specsFor(t)) if (s.key in obj) nextValues[s.key] = obj[s.key];
      const nextExtras: [string, string][] = Object.entries(obj)
        .filter(([k]) => !ALL_SPEC_KEYS.has(k) && !HIDDEN_KEYS.has(k))
        .map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]);
      const patch: Partial<NamedTemplate> = {};
      if (!template.name.trim()) patch.name = file.name.replace(/\.json$/i, "");
      patch.metadata = buildMetadata(
        nextValues,
        nextExtras.map(([k, v]) => {
          try {
            return [k, JSON.parse(v)];
          } catch {
            return [k, v];
          }
        }),
        t
      );
      metaRef.current = patch.metadata;
      setType(t);
      setValues(nextValues);
      setExtras(nextExtras);
      onChange(patch);
      setExpanded(true);
    } catch (e) {
      setFileErr(`Couldn't read ${file.name}: ${(e as Error).message}`);
    }
  };

  const lbl = { fontSize: 11, textTransform: "uppercase" as const, letterSpacing: ".05em" };
  const grid = "minmax(150px, 210px) 1fr 26px";

  return (
    <div className="template-block">
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <label>Template name · {type === "racing" ? "Racing" : "Sport"}</label>
          <input
            value={template.name}
            placeholder="e.g. AFL Best Bet"
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
        <button className="danger" onClick={onRemove}>
          Delete
        </button>
      </div>

      <div className="template-file">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <button className="secondary" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide metadata" : "View metadata"}
        </button>
        <button className="secondary" onClick={() => fileRef.current?.click()}>
          Replace JSON file
        </button>
      </div>

      {expanded && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg)",
            padding: 12,
            marginTop: 10,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: grid, gap: 8 }}>
            <span className="muted" style={lbl}>Field</span>
            <span className="muted" style={lbl}>Value</span>
            <span />
          </div>

          {specsFor(type).map((s) => (
            <Fragment key={s.key}>
              <div
                style={{ display: "grid", gridTemplateColumns: grid, gap: 8, alignItems: "start", marginTop: 8 }}
              >
                <div className="mono" style={{ fontSize: 13, paddingTop: 8, wordBreak: "break-word" }}>
                  {s.key}
                </div>
                <FieldControl spec={s} value={values[s.key]} onChange={(v) => setValue(s.key, v)} />
                <span />
              </div>
              {s.key === TALENT_LIST_KEY && (
                <div
                  style={{ display: "grid", gridTemplateColumns: grid, gap: 8, alignItems: "start", marginTop: 8 }}
                >
                  <div className="mono" style={{ fontSize: 13, paddingTop: 8, opacity: 0.65 }}>
                    {TIPPER_KEY}
                  </div>
                  <div>
                    <input
                      value={derivedTippers(values[TALENT_LIST_KEY])}
                      disabled
                      style={{ width: "100%", opacity: 0.65 }}
                    />
                    <div className="muted" style={{ fontSize: 12 }}>
                      Auto-filled from the talent(s) — saved as {TIPPER_KEY}.
                    </div>
                  </div>
                  <span />
                </div>
              )}
            </Fragment>
          ))}

          {extras.map(([k, v], i) => (
            <div
              key={`extra-${i}`}
              style={{ display: "grid", gridTemplateColumns: grid, gap: 8, alignItems: "start", marginTop: 8 }}
            >
              <input
                className="mono"
                value={k}
                placeholder="key"
                onChange={(e) => setExtra(i, [e.target.value, v])}
              />
              <input value={v} onChange={(e) => setExtra(i, [k, e.target.value])} style={{ width: "100%" }} />
              <button
                className="secondary"
                title="Remove field"
                onClick={() => removeExtra(i)}
                style={{ padding: "8px 10px", background: "transparent", border: "none", color: "var(--muted)" }}
              >
                ×
              </button>
            </div>
          ))}

          <button className="secondary" style={{ marginTop: 10 }} onClick={addExtra}>
            + Add custom field
          </button>
        </div>
      )}

      {fileErr && <div className="error">{fileErr}</div>}
    </div>
  );
};

const derivedTippers = (value: unknown): string => {
  const ids = Array.isArray(value) ? (value as string[]) : [];
  if (!ids.length) return "—";
  return ids.map((id) => talentById(String(id))?.tipperId || "—").join(", ");
};

interface ControlProps {
  spec: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
}

const FieldControl = ({ spec, value, onChange }: ControlProps) => {
  const c = spec.control;
  if (c.kind === "locked") {
    return (
      <span className="muted" style={{ fontSize: 13, padding: "8px 0" }}>
        entered by talent in-app
      </span>
    );
  }
  if (c.kind === "text") {
    return (
      <input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} style={{ width: "100%" }} />
    );
  }
  if (c.kind === "bool") {
    // Yes/No dropdown (same look as IsAvailableOnPlatform) but stored as a real boolean.
    return (
      <select value={value ? "Yes" : "No"} onChange={(e) => onChange(e.target.value === "Yes")}>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    );
  }
  if (c.kind === "yesno") {
    return (
      <select value={(value as string) ?? "Yes"} onChange={(e) => onChange(e.target.value)}>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    );
  }
  if (c.kind === "range") {
    return (
      <select value={value === "" || value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}>
        <option value="">—</option>
        {Array.from({ length: c.max - c.min + 1 }, (_, i) => c.min + i).map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    );
  }
  if (c.kind === "date") {
    const v = typeof value === "string" ? value.slice(0, 10) : "";
    return (
      <input
        type="date"
        value={v}
        onWheel={(e) => e.currentTarget.blur()}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}T00:00:00` : "")}
        style={{ width: "100%" }}
      />
    );
  }
  if (c.kind === "datetime") {
    const s = typeof value === "string" ? value : "";
    const m = s.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    const local = m ? m[1] : "";
    const off = s.match(/(?:Z|[+-]\d{2}:\d{2})$/)?.[0] ?? "+10:00";
    return (
      <div>
        <input
          type="datetime-local"
          value={local}
          onWheel={(e) => e.currentTarget.blur()}
          onChange={(e) => onChange(e.target.value ? `${e.target.value}:00${melbourneOffset(e.target.value)}` : "")}
          style={{ width: "100%" }}
        />
        <div className="muted" style={{ fontSize: 12 }}>
          Melbourne {offsetLabel(off)} — daylight saving handled automatically.
        </div>
      </div>
    );
  }
  // lookup — single values are a dropdown list; multi values type-to-filter.
  if (!c.multi) {
    return (
      <select value={(value as string) || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">— select —</option>
        {c.options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    );
  }
  return <LookupField options={c.options} multi value={value} onChange={onChange} />;
};

interface LookupProps {
  options: Option[];
  multi: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
}

const LookupField = ({ options, multi, value, onChange }: LookupProps) => {
  const external = multi
    ? (Array.isArray(value) ? (value as string[]) : []).map((id) => optName(options, id)).join(", ")
    : value
    ? optName(options, value as string)
    : "";
  const [text, setText] = useState(external);
  const lastExternal = useRef(external);
  const listId = useMemo(() => `lk_${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    if (external !== lastExternal.current) {
      lastExternal.current = external;
      setText(external);
    }
  }, [external]);

  const commit = (t: string) => {
    setText(t);
    if (multi) {
      const ids = t
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((n) => optId(options, n))
        .filter((x): x is string => !!x);
      lastExternal.current = ids.map((id) => optName(options, id)).join(", ");
      onChange(ids);
    } else {
      const id = optId(options, t) ?? "";
      lastExternal.current = id ? optName(options, id) : "";
      onChange(id);
    }
  };

  return (
    <div>
      <input
        value={text}
        list={listId}
        placeholder={multi ? "Type name(s), comma-separated" : "Type to search…"}
        onChange={(e) => commit(e.target.value)}
        style={{ width: "100%" }}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.id} value={o.name} />
        ))}
      </datalist>
    </div>
  );
};

export default Users;
