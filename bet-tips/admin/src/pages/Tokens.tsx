import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { TALENTS, talentById } from "../data/talents";

interface Token {
  token: string;
  status: "active" | "used" | "revoked";
  note?: string;
  createdAt: string;
  expiresAt?: string;
  usedBy?: string;
  usedAt?: string;
  talentId?: string;
  talentName?: string;
  talentInitials?: string;
}

const Tokens = () => {
  const [list, setList] = useState<Token[]>([]);
  const [note, setNote] = useState("");
  const [talentId, setTalentId] = useState("");
  const [initials, setInitials] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Token | null>(null);

  const onTalentChange = (id: string) => {
    setTalentId(id);
    setInitials(talentById(id)?.initials ?? "");
  };

  const load = async () => {
    setLoading(true);
    try {
      const tokensRes = await api<{ tokens: Token[] }>("/admin/tokens");
      setList(tokensRes.tokens);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    const talent = talentId ? talentById(talentId) : undefined;
    const trimmedInitials = initials.trim().toUpperCase();
    if (talent && !trimmedInitials) {
      setErr("Initials are required when a talent is assigned");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api("/admin/tokens", {
        method: "POST",
        body: {
          note: note.trim() || undefined,
          talentId: talent?.id,
          talentName: talent?.name,
          talentInitials: talent ? trimmedInitials : undefined,
        },
      });
      setNote("");
      setTalentId("");
      setInitials("");
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (token: string) => {
    if (!confirm(`Revoke token ${token}?`)) return;
    try {
      await api(`/admin/tokens/${token}`, { method: "DELETE" });
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <h2>Signup Tokens</h2>
      </div>

      <div className="card">
        <label>Issue new token</label>
        <div className="row">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note, e.g. for @tipsgenius"
          />
          <select value={talentId} onChange={(e) => onTalentChange(e.target.value)}>
            <option value="">No talent</option>
            {TALENTS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            value={initials}
            onChange={(e) => setInitials(e.target.value.toUpperCase())}
            placeholder="Initials"
            style={{ width: 90 }}
            disabled={!talentId}
            title="Initials used for GenericContentType (e.g. AFL_FEED_DH)"
          />
          <button onClick={create} disabled={busy}>
            {busy ? "Issuing…" : "Issue token"}
          </button>
        </div>
        <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          Metadata templates are managed per user on the Users page after signup.
        </div>
        {err && <div className="error">{err}</div>}
      </div>

      <div className="card">
        {loading ? (
          <div className="muted">Loading…</div>
        ) : list.length === 0 ? (
          <div className="muted">No tokens yet. Issue one above.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>Status</th>
                <th>Talent</th>
                <th>Note</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.token}>
                  <td className="mono">{t.token}</td>
                  <td>
                    <span className={`badge ${t.status}`}>{t.status}</span>
                  </td>
                  <td>{t.talentName ? `${t.talentName} (${t.talentInitials})` : ""}</td>
                  <td>{t.note ?? ""}</td>
                  <td className="muted">{new Date(t.createdAt).toLocaleString()}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {t.status !== "revoked" && (
                      <button className="secondary" onClick={() => setEditing(t)}>
                        Edit
                      </button>
                    )}
                    {t.status === "active" && (
                      <button
                        className="danger"
                        style={{ marginLeft: 8 }}
                        onClick={() => revoke(t.token)}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <EditTokenModal
          token={editing}
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

interface EditModalProps {
  token: Token;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

const EditTokenModal = ({ token, onClose, onSaved }: EditModalProps) => {
  const [note, setNote] = useState(token.note ?? "");
  const [talentId, setTalentId] = useState(token.talentId ?? "");
  const [initials, setInitials] = useState(token.talentInitials ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onTalentChange = (id: string) => {
    setTalentId(id);
    setInitials(talentById(id)?.initials ?? "");
  };

  const save = async () => {
    const talent = talentId ? talentById(talentId) : undefined;
    const trimmedInitials = initials.trim().toUpperCase();
    if (talent && !trimmedInitials) {
      setErr("Initials are required when a talent is assigned");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api(`/admin/tokens/${token.token}`, {
        method: "PATCH",
        body: {
          note: note.trim(),
          // Empty strings clear the talent on the server.
          talentId: talent?.id ?? "",
          talentName: talent?.name ?? "",
          talentInitials: talent ? trimmedInitials : "",
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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>
          Edit token <span className="mono">{token.token}</span>
        </h3>
        <div className="muted" style={{ marginBottom: 16 }}>
          {token.status === "used"
            ? "This token has been redeemed — talent changes also apply to the signed-up account."
            : "Changes apply when this token is redeemed."}
        </div>

        <label>Note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />

        <div className="row" style={{ marginTop: 12 }}>
          <div style={{ flex: 2 }}>
            <label>Talent</label>
            <select value={talentId} onChange={(e) => onTalentChange(e.target.value)}>
              <option value="">No talent</option>
              {TALENTS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ width: 110 }}>
            <label>Initials</label>
            <input
              value={initials}
              onChange={(e) => setInitials(e.target.value.toUpperCase())}
              disabled={!talentId}
            />
          </div>
        </div>

        {err && <div className="error">{err}</div>}

        <div className="actions">
          <button className="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Tokens;
