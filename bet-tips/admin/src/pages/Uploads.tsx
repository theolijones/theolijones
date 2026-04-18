import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Upload {
  uploadId: string;
  userId: string;
  status: "pending" | "approved" | "rejected";
  videoKey: string;
  metadataKey: string;
  videoUrl?: string;
  metadataUrl?: string;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
}

type Tab = "pending" | "approved" | "rejected";

const Uploads = () => {
  const [tab, setTab] = useState<Tab>("pending");
  const [list, setList] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async (status: Tab) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api<{ uploads: Upload[] }>(`/admin/uploads?status=${status}`);
      setList(res.uploads);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(tab);
  }, [tab]);

  const review = async (uploadId: string, decision: "approved" | "rejected") => {
    let note: string | undefined;
    if (decision === "rejected") {
      const entered = prompt("Reason for rejection (shown to the user):");
      if (!entered) return;
      note = entered;
    }
    try {
      await api(`/admin/uploads/${uploadId}`, {
        method: "PATCH",
        body: { decision, note },
      });
      await load(tab);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <h2>Uploads</h2>
        <div className="row">
          {(["pending", "approved", "rejected"] as Tab[]).map((t) => (
            <button
              key={t}
              className={t === tab ? "" : "secondary"}
              onClick={() => setTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card muted">Loading…</div>
      ) : err ? (
        <div className="card error">{err}</div>
      ) : list.length === 0 ? (
        <div className="card muted">No uploads in this bucket yet.</div>
      ) : (
        list.map((u) => (
          <div className="card" key={u.uploadId}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div className="mono" style={{ fontSize: 12 }}>{u.uploadId}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  User {u.userId} · {new Date(u.createdAt).toLocaleString()}
                </div>
              </div>
              <span className={`badge ${u.status}`}>{u.status}</span>
            </div>

            {u.videoUrl && (
              <video
                src={u.videoUrl}
                controls
                style={{ maxWidth: 360, borderRadius: 6, marginBottom: 8, background: "#000" }}
              />
            )}

            <div className="row" style={{ gap: 16, marginBottom: 8 }}>
              {u.metadataUrl && (
                <a href={u.metadataUrl} target="_blank" rel="noreferrer">
                  View metadata JSON
                </a>
              )}
              {u.videoUrl && (
                <a href={u.videoUrl} target="_blank" rel="noreferrer">
                  Download video
                </a>
              )}
            </div>

            {u.reviewNote && (
              <div className="muted" style={{ marginBottom: 8 }}>
                <strong>Review note:</strong> {u.reviewNote}
              </div>
            )}

            {u.status === "pending" && (
              <div className="row">
                <button onClick={() => review(u.uploadId, "approved")}>Approve</button>
                <button className="danger" onClick={() => review(u.uploadId, "rejected")}>
                  Reject
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default Uploads;
