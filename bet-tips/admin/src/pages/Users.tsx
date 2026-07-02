import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";

/** Key of the Bet ID field the mobile app fills in at submit. Mirrors the backend. */
const BET_ID_FIELD_KEY = "FeedTipId";

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

  const addTemplate = () =>
    setTemplates((prev) => [...prev, { id: newId(), name: "", metadata: {} }]);

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
    if (templates.some((t) => Object.keys(t.metadata).length === 0)) {
      setErr("Every template needs a metadata JSON file uploaded.");
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

        <button className="secondary" style={{ marginTop: 8 }} onClick={addTemplate}>
          + Add template
        </button>

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
  const fieldCount = Object.keys(template.metadata).length;
  const hasBetId = BET_ID_FIELD_KEY in template.metadata;

  const onFile = async (file: File | undefined) => {
    setFileErr(null);
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("JSON must be an object");
      }
      const patch: Partial<NamedTemplate> = { metadata: parsed as Record<string, unknown> };
      // Default the template name to the filename (sans extension) on first upload.
      if (!template.name.trim()) patch.name = file.name.replace(/\.json$/i, "");
      onChange(patch);
    } catch (e) {
      setFileErr(`Couldn't read ${file.name}: ${(e as Error).message}`);
    }
  };

  return (
    <div className="template-block">
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <label>Template name</label>
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
        <button className="secondary" onClick={() => fileRef.current?.click()}>
          {fieldCount ? "Replace JSON file" : "Upload JSON file"}
        </button>
        <span className="muted">
          {fieldCount ? (
            <>
              {fieldCount} field{fieldCount === 1 ? "" : "s"} loaded
              {hasBetId ? (
                <> · <span className="mono">{BET_ID_FIELD_KEY}</span> present</>
              ) : (
                <>
                  {" "}
                  · <span style={{ color: "var(--warn, #d97706)" }}>
                    no <span className="mono">{BET_ID_FIELD_KEY}</span> field (the app adds it)
                  </span>
                </>
              )}
            </>
          ) : (
            "No file uploaded yet"
          )}
        </span>
      </div>
      {fileErr && <div className="error">{fileErr}</div>}
    </div>
  );
};

export default Users;
