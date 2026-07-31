import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { downloadMetadata, hasMetadata } from "../data/metadata";

type RenderStatus = "not_required" | "queued" | "rendering" | "done" | "failed";

interface Upload {
  uploadId: string;
  userId: string;
  status: "pending" | "approved" | "rejected";
  videoKey: string;
  videoUrl?: string;
  renderedVideoUrl?: string;
  renderStatus?: RenderStatus;
  renderError?: string;
  metadata?: Record<string, unknown>;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
}

const renderLabel: Record<RenderStatus, string> = {
  not_required: "No overlays",
  queued: "Render queued",
  rendering: "Rendering…",
  done: "Rendered",
  failed: "Render failed",
};

type Tab = "pending" | "approved" | "rejected";

/**
 * Upload player, sized to whatever orientation the clip actually is.
 *
 * `<video>` is a CSS replaced element, so under `max-width` + `max-height` with
 * both dimensions auto the browser preserves the intrinsic aspect ratio — a
 * 16:9 clip lands 480×270 and a 9:16 clip 236×420, neither stretched. Browsers
 * also apply the mp4 rotation matrix before exposing `videoWidth`/`videoHeight`,
 * so these are display dimensions: a portrait iPhone recording is stored 1920×1080
 * with rotation −90 and reports 1080×1920 here.
 *
 * The caption exists because the previous player showed no dimensions at all,
 * which made "correctly portrait" and "landscape squashed into portrait"
 * indistinguishable by eye — and the source of a stretched render is the EDL
 * canvas, which is not visible anywhere in this UI.
 */
const MAX_W = 480;
const MAX_H = 420;

/**
 * View-only rotation, in degrees clockwise. Nothing is written back — this is a
 * workaround for recordings whose mp4 rotation tag doesn't match how the phone
 * was held, so a landscape take can be watched the right way up.
 *
 * Deliberately manual: a correctly-tagged portrait recording and a mis-tagged
 * landscape one are metadata-identical, so nothing here can infer which needs
 * correcting — an automatic rotation would fix one and break the other.
 *
 * `rotation` is owned by the parent so it survives a poll re-rendering the list.
 */
const UploadVideo = ({
  src,
  isRender,
  rotation,
  onRotate,
  onSave,
  saving,
}: {
  src: string;
  isRender: boolean;
  rotation: number;
  onRotate: () => void;
  onSave: () => void;
  saving: boolean;
}) => {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  const quarterTurned = rotation % 180 !== 0;
  // Footprint the rotated video occupies, and the scale that fits it in the box.
  const visualW = dims ? (quarterTurned ? dims.h : dims.w) : 0;
  const visualH = dims ? (quarterTurned ? dims.w : dims.h) : 0;
  const scale = visualW && visualH ? Math.min(MAX_W / visualW, MAX_H / visualH) : 0;

  return (
    <div style={{ marginBottom: 8 }}>
      {/* The wrapper is sized to the *rotated* footprint, because a CSS
          transform doesn't affect layout — without it a quarter-turned video
          overflows its own box and covers the card. */}
      <div
        style={{
          position: "relative",
          width: visualW * scale || MAX_W,
          height: visualH * scale || 270,
          background: "#000",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <video
          src={src}
          controls
          onLoadedMetadata={(e) =>
            setDims({
              w: e.currentTarget.videoWidth,
              h: e.currentTarget.videoHeight,
            })
          }
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            // Unrotated size; the rotation then swaps its visual footprint to
            // match the wrapper. Centring via translate keeps it aligned for
            // every angle without per-angle offset maths.
            width: dims ? dims.w * scale : "100%",
            height: dims ? dims.h * scale : "100%",
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          }}
        />
      </div>
      <div className="row" style={{ gap: 8, marginTop: 6, alignItems: "center" }}>
        <button
          className="secondary"
          style={{ padding: "4px 10px", fontSize: 12 }}
          onClick={onRotate}
          disabled={saving}
        >
          ⟳ Rotate
        </button>
        {rotation !== 0 && (
          <button
            style={{ padding: "4px 10px", fontSize: 12 }}
            onClick={onSave}
            disabled={saving}
            title="Rewrite the stored file's rotation tag. Lossless — the video is not re-encoded."
          >
            {saving ? "Saving…" : `Save +${rotation}°`}
          </button>
        )}
        <span className="muted" style={{ fontSize: 12 }}>
          {dims
            ? `${dims.w}×${dims.h} · ${dims.w > dims.h ? "landscape" : "portrait"}`
            : "…"}
          {" · "}
          {isRender ? "rendered output" : "original upload"}
          {rotation !== 0 && ` · viewing +${rotation}°`}
        </span>
      </div>
    </div>
  );
};

const Uploads = () => {
  const [tab, setTab] = useState<Tab>("pending");
  const [list, setList] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Rotation is held here, not inside UploadVideo, so it survives the list
  // being re-rendered by a poll. Keyed by uploadId.
  const [rotations, setRotations] = useState<Record<string, number>>({});
  const rotate = (uploadId: string) =>
    setRotations((r) => ({ ...r, [uploadId]: ((r[uploadId] ?? 0) + 90) % 360 }));

  // /admin/uploads signs fresh presigned URLs on every call, so a poll would
  // otherwise hand <video> a new src every 10s and restart playback mid-watch.
  // Pin the first URL seen per upload. The key includes which file is being
  // shown, so when a render completes the new URL is picked up.
  const urlCache = useRef<Map<string, string>>(new Map());
  const stableUrl = (key: string, url: string) => {
    const cached = urlCache.current.get(key);
    if (cached) return cached;
    urlCache.current.set(key, url);
    return url;
  };

  const [savingRotation, setSavingRotation] = useState<string | null>(null);

  // Bake the previewed rotation into the stored file. The backend reads the
  // file's current rotation and adds this delta, so the UI never needs to know
  // what the container currently declares.
  const saveRotation = async (uploadId: string) => {
    const delta = rotations[uploadId] ?? 0;
    if (!delta) return;
    setSavingRotation(uploadId);
    setErr(null);
    try {
      await api(`/admin/uploads/${uploadId}/rotate`, {
        method: "POST",
        body: { delta },
      });
      // Drop the pinned URLs so the reload signs fresh ones. The object is
      // overwritten in place, so without a new signature the browser would
      // happily serve the pre-rotation copy from cache.
      urlCache.current.delete(`${uploadId}|source`);
      urlCache.current.delete(`${uploadId}|render`);
      setRotations((r) => ({ ...r, [uploadId]: 0 }));
      await load(tab);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSavingRotation(null);
    }
  };

  const load = async (status: Tab, background = false) => {
    // A background poll must not flip `loading`: that swaps the list for the
    // "Loading…" card, unmounting every row and losing their state.
    if (!background) setLoading(true);
    setErr(null);
    try {
      const res = await api<{ uploads: Upload[] }>(`/admin/uploads?status=${status}`);
      setList(res.uploads);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      if (!background) setLoading(false);
    }
  };

  useEffect(() => {
    void load(tab);
  }, [tab]);

  // Poll while any upload is still rendering, so the admin sees render
  // completion without manually refreshing. Only active on pending tab.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (tab !== "pending") return;
    const anyActive = list.some(
      (u) => u.renderStatus === "queued" || u.renderStatus === "rendering"
    );
    if (!anyActive) return;
    pollRef.current = setInterval(() => void load(tab, true), 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [list, tab]);

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
              <div className="row" style={{ gap: 8 }}>
                {u.renderStatus && u.renderStatus !== "not_required" && (
                  <span className={`badge render-${u.renderStatus}`}>
                    {renderLabel[u.renderStatus]}
                  </span>
                )}
                <span className={`badge ${u.status}`}>{u.status}</span>
              </div>
            </div>

            {(() => {
              const showingRender = u.renderStatus === "done" && !!u.renderedVideoUrl;
              const playbackUrl = showingRender ? u.renderedVideoUrl : u.videoUrl;
              if (!playbackUrl) return null;
              return (
                <UploadVideo
                  src={stableUrl(
                    `${u.uploadId}|${showingRender ? "render" : "source"}`,
                    playbackUrl
                  )}
                  isRender={showingRender}
                  rotation={rotations[u.uploadId] ?? 0}
                  onRotate={() => rotate(u.uploadId)}
                  onSave={() => void saveRotation(u.uploadId)}
                  saving={savingRotation === u.uploadId}
                />
              );
            })()}

            {u.renderStatus === "rendering" && (
              <div className="muted" style={{ marginBottom: 8, fontSize: 13 }}>
                Waiting for the server to finish rendering overlays…
              </div>
            )}

            {u.renderStatus === "failed" && u.renderError && (
              <div className="error" style={{ marginBottom: 8 }}>
                <strong>Render failed:</strong> {u.renderError}
              </div>
            )}

            {u.metadata && Object.keys(u.metadata).length > 0 && (
              <MetadataTable metadata={u.metadata} />
            )}

            {(u.videoUrl || hasMetadata(u.metadata)) && (
              <div className="row" style={{ gap: 16, marginBottom: 8 }}>
                {u.videoUrl && (
                  <a href={u.videoUrl} target="_blank" rel="noreferrer">
                    Download video
                  </a>
                )}
                {hasMetadata(u.metadata) && (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      downloadMetadata(u.metadata!, u.videoKey);
                    }}
                  >
                    Download metadata
                  </a>
                )}
              </div>
            )}

            {u.reviewNote && (
              <div className="muted" style={{ marginBottom: 8 }}>
                <strong>Review note:</strong> {u.reviewNote}
              </div>
            )}

            {u.status === "pending" && (
              <div className="row">
                <button
                  onClick={() => review(u.uploadId, "approved")}
                  disabled={u.renderStatus === "queued" || u.renderStatus === "rendering"}
                  title={
                    u.renderStatus === "queued" || u.renderStatus === "rendering"
                      ? "Waiting for render to finish"
                      : undefined
                  }
                >
                  Approve
                </button>
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

interface MetadataTableProps {
  metadata: Record<string, unknown>;
}

const MetadataTable = ({ metadata }: MetadataTableProps) => {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      // Some browsers require https or user gesture; fall back to select
    }
  };

  const rows = Object.entries(metadata);
  if (rows.length === 0) return null;

  return (
    <table
      style={{
        marginBottom: 12,
        background: "var(--panel-2)",
        borderRadius: 6,
      }}
    >
      <tbody>
        {rows.map(([key, value]) => {
          const display = typeof value === "string" ? value : JSON.stringify(value);
          const canCopy = typeof value === "string" && value.length > 0;
          return (
            <tr key={key}>
              <th style={{ width: 160, textTransform: "none", paddingLeft: 14 }}>{key}</th>
              <td className="mono" style={{ wordBreak: "break-all" }}>
                {display}
              </td>
              <td style={{ width: 90, textAlign: "right", paddingRight: 14 }}>
                {canCopy && (
                  <button
                    className="secondary"
                    style={{ padding: "4px 10px", fontSize: 12 }}
                    onClick={() => void copy(key, display)}
                  >
                    {copied === key ? "Copied" : "Copy"}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default Uploads;
