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

  const onTalentChange = (id: string) => {
    setTalentId(id);
    setInitials(talentById(id)?.initials ?? "");
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api<{ tokens: Token[] }>("/admin/tokens");
      setList(res.tokens);
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
                <th>Used</th>
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
                  <td className="muted">
                    {t.usedAt ? new Date(t.usedAt).toLocaleString() : ""}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {t.status === "active" && (
                      <button className="danger" onClick={() => revoke(t.token)}>
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
    </div>
  );
};

export default Tokens;
