import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import {
  templatableFields,
  type NamedTemplate,
  type Schema,
  type SchemaField,
} from "../data/metadataFields";
import MetadataTemplate from "../components/MetadataTemplate";

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
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<User | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, schemaRes] = await Promise.all([
        api<{ users: User[] }>("/admin/users"),
        api<Schema>("/admin/schema"),
      ]);
      setList(usersRes.users);
      setFields(schemaRes.fields);
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
          fields={fields}
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
  fields: SchemaField[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

const TemplatesModal = ({ user, fields, onClose, onSaved }: ModalProps) => {
  const [templates, setTemplates] = useState<NamedTemplate[]>(
    // Deep-ish clone so edits don't mutate the list until saved.
    user.metadataTemplates.map((t) => ({ ...t, values: { ...t.values } }))
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editable = templatableFields(fields);

  const addTemplate = () =>
    setTemplates((prev) => [...prev, { id: newId(), name: "", values: {} }]);

  const updateTemplate = (id: string, patch: Partial<NamedTemplate>) =>
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const removeTemplate = (id: string) =>
    setTemplates((prev) => prev.filter((t) => t.id !== id));

  const save = async () => {
    // Local validation mirrors the server so the admin gets fast feedback.
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
            values: t.values,
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
          The talent picks one of these in the app, enters a Bet ID, and submits. The Bet ID
          fills the <span className="mono">FeedTipId</span> field automatically.
        </div>

        {templates.length === 0 && (
          <div className="muted" style={{ marginBottom: 12 }}>
            No templates yet. Add one below.
          </div>
        )}

        {templates.map((t) => (
          <div key={t.id} className="template-block">
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label>Template name</label>
                <input
                  value={t.name}
                  placeholder="e.g. AFL Best Bet"
                  onChange={(e) => updateTemplate(t.id, { name: e.target.value })}
                />
              </div>
              <button className="danger" onClick={() => removeTemplate(t.id)}>
                Delete
              </button>
            </div>
            {editable.length > 0 ? (
              <MetadataTemplate
                fields={fields}
                value={t.values}
                onChange={(values) => updateTemplate(t.id, { values })}
              />
            ) : (
              <div className="muted">No templatable fields in the current schema.</div>
            )}
          </div>
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

export default Users;
