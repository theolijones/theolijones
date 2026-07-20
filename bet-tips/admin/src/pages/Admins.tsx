import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";

/** Mirrors MIN_PASSWORD_LENGTH in backend/lambda/shared/passwords.ts. */
const MIN_PASSWORD_LENGTH = 12;

interface Admin {
  userId: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
  isSelf: boolean;
}

const Admins = () => {
  const [list, setList] = useState<Admin[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState<Admin | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api<{ admins: Admin[] }>("/admin/admins");
      setList(res.admins);
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
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      await api("/admin/admins", {
        method: "POST",
        body: { email: email.trim(), password },
      });
      setNotice(`Created ${email.trim().toLowerCase()}. Send them the password securely.`);
      setEmail("");
      setPassword("");
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canCreate =
    !busy && email.trim().length > 0 && password.length >= MIN_PASSWORD_LENGTH;

  return (
    <div>
      <h2>Admins</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Accounts that can log in to this console. Talent don’t appear here — they sign
        up with a token and have no password. See <strong>Signup Tokens</strong>.
      </p>

      {err && <div className="error" style={{ marginBottom: 12 }}>{err}</div>}
      {notice && <div className="muted" style={{ marginBottom: 12 }}>{notice}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Add an admin</h3>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
          <input
            type="email"
            placeholder="name@example.com"
            value={email}
            autoComplete="off"
            onChange={(e) => setEmail(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              style={{ minWidth: 220 }}
            />
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {password.length === 0
                ? `At least ${MIN_PASSWORD_LENGTH} characters`
                : password.length < MIN_PASSWORD_LENGTH
                  ? `${MIN_PASSWORD_LENGTH - password.length} more character${
                      MIN_PASSWORD_LENGTH - password.length === 1 ? "" : "s"
                    } needed`
                  : "Long enough"}
            </div>
          </div>
          <button disabled={!canCreate} onClick={() => void create()}>
            {busy ? "Creating…" : "Create admin"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="muted">Loading…</div>
      ) : list.length === 0 ? (
        <div className="muted">No admin accounts found.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Created</th>
              <th>Password last set</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.userId}>
                <td>
                  {a.email ?? <span className="muted">no email</span>}
                  {a.isSelf && <span className="muted"> · you</span>}
                </td>
                <td className="muted">{new Date(a.createdAt).toLocaleDateString()}</td>
                <td className="muted">{new Date(a.updatedAt).toLocaleDateString()}</td>
                <td>
                  <button className="secondary" onClick={() => setResetting(a)}>
                    Set password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {resetting && (
        <SetPasswordDialog
          admin={resetting}
          onClose={() => setResetting(null)}
          onDone={(message) => {
            setResetting(null);
            setNotice(message);
            void load();
          }}
        />
      )}
    </div>
  );
};

interface DialogProps {
  admin: Admin;
  onClose: () => void;
  onDone: (message: string) => void;
}

const SetPasswordDialog = ({ admin, onClose, onDone }: DialogProps) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const canSave =
    !busy && password.length >= MIN_PASSWORD_LENGTH && password === confirm;

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/admin/admins/${admin.userId}/password`, {
        method: "PUT",
        body: { password },
      });
      onDone(
        admin.isSelf
          ? "Your password was changed. Existing sessions stay signed in until their tokens expire."
          : `Password set for ${admin.email ?? admin.userId}. Send it to them securely.`
      );
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : (e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>
        Set password — {admin.email ?? admin.userId}
        {admin.isSelf && " (you)"}
      </h3>
      {admin.isSelf && (
        <p className="muted" style={{ marginTop: -4 }}>
          You’re changing your own password. Make sure you can remember it — there is no
          recovery flow, only another admin resetting it for you.
        </p>
      )}
      {err && <div className="error" style={{ marginBottom: 12 }}>{err}</div>}
      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
        <input
          type="password"
          placeholder="New password"
          value={password}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
          style={{ minWidth: 220 }}
        />
        <input
          type="password"
          placeholder="Confirm"
          value={confirm}
          autoComplete="new-password"
          onChange={(e) => setConfirm(e.target.value)}
          style={{ minWidth: 220 }}
        />
        <button disabled={!canSave} onClick={() => void save()}>
          {busy ? "Saving…" : "Save password"}
        </button>
        <button className="secondary" disabled={busy} onClick={onClose}>
          Cancel
        </button>
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        {mismatch
          ? "Passwords don’t match"
          : password.length > 0 && password.length < MIN_PASSWORD_LENGTH
            ? `At least ${MIN_PASSWORD_LENGTH} characters`
            : ""}
      </div>
    </div>
  );
};

export default Admins;
