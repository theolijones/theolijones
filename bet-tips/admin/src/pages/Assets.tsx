import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";

type AssetKind = "sticker" | "image" | "gif" | "background";

interface Asset {
  assetId: string;
  kind: AssetKind;
  title: string;
  contentType: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
}

interface CreateResponse {
  assetId: string;
  kind: AssetKind;
  title: string;
  contentType: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  uploadUrl: string;
}

const ACCEPT_FOR_KIND: Record<AssetKind, string> = {
  sticker: "image/png,image/jpeg,image/webp",
  image: "image/png,image/jpeg,image/webp",
  background: "image/png,image/jpeg,image/webp",
  gif: "image/gif",
};

const KIND_LABELS: Record<AssetKind, string> = {
  sticker: "Sticker",
  image: "Image",
  gif: "GIF",
  background: "Background",
};

type KindFilter = "all" | AssetKind;
const KIND_FILTERS: KindFilter[] = ["all", "sticker", "image", "gif", "background"];
const KIND_FILTER_LABELS: Record<KindFilter, string> = {
  all: "All",
  ...KIND_LABELS,
};

const Assets = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [uploadKind, setUploadKind] = useState<AssetKind>("sticker");
  const [filter, setFilter] = useState<KindFilter>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async (includeInactive: boolean) => {
    setLoading(true);
    setErr(null);
    try {
      const path = includeInactive ? "/library/assets?all=1" : "/library/assets";
      const res = await api<{ assets: Asset[] }>(path);
      setAssets(res.assets);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(showInactive);
  }, [showInactive]);

  const onPickFiles = () => fileInputRef.current?.click();

  const onFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setErr(null);
    const accepted = ACCEPT_FOR_KIND[uploadKind].split(",");
    try {
      for (const file of Array.from(files)) {
        if (!accepted.includes(file.type)) {
          throw new Error(
            `${file.name}: ${file.type || "unknown"} not allowed for kind "${uploadKind}"`
          );
        }
        const created = await api<CreateResponse>("/admin/library/assets", {
          method: "POST",
          body: {
            kind: uploadKind,
            title: file.name.replace(/\.[^.]+$/, ""),
            contentType: file.type,
          },
        });
        const put = await fetch(created.uploadUrl, {
          method: "PUT",
          headers: { "content-type": file.type },
          body: file,
        });
        if (!put.ok) throw new Error(`S3 upload failed: ${put.status}`);
      }
      await load(showInactive);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleActive = async (a: Asset) => {
    setErr(null);
    try {
      await api(`/admin/library/assets/${a.assetId}`, {
        method: "PATCH",
        body: { active: !a.active },
      });
      await load(showInactive);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const renameAsset = async (a: Asset) => {
    const next = window.prompt("Rename asset", a.title);
    if (!next || next.trim() === a.title) return;
    setErr(null);
    try {
      await api(`/admin/library/assets/${a.assetId}`, {
        method: "PATCH",
        body: { title: next.trim() },
      });
      await load(showInactive);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const deleteAsset = async (a: Asset) => {
    if (!window.confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
    setErr(null);
    try {
      await api(`/admin/library/assets/${a.assetId}`, { method: "DELETE" });
      await load(showInactive);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const filtered = useMemo(
    () => (filter === "all" ? assets : assets.filter((a) => a.kind === filter)),
    [assets, filter]
  );

  return (
    <div>
      <div className="toolbar">
        <h2>Asset Library</h2>
        <div className="row">
          <label
            className="row"
            style={{ margin: 0, textTransform: "none", fontSize: 13, color: "var(--muted)", letterSpacing: 0 }}
          >
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              style={{ width: "auto", marginRight: 6 }}
            />
            Show inactive
          </label>
          <select
            value={uploadKind}
            onChange={(e) => setUploadKind(e.target.value as AssetKind)}
            disabled={uploading}
            style={{ width: "auto" }}
          >
            <option value="sticker">Upload as: Sticker</option>
            <option value="image">Upload as: Image</option>
            <option value="gif">Upload as: GIF</option>
            <option value="background">Upload as: Background</option>
          </select>
          <button className="secondary" onClick={onPickFiles} disabled={uploading}>
            {uploading ? "Uploading…" : "+ Upload assets"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_FOR_KIND[uploadKind]}
            multiple
            style={{ display: "none" }}
            onChange={(e) => void onFilesSelected(e.target.files)}
          />
        </div>
      </div>

      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Stickers, images, GIFs, and chroma-key backgrounds available to users in
          the in-app editor. Inactive assets are hidden from the mobile app but kept here.
        </p>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {KIND_FILTERS.map((f) => (
            <button
              key={f}
              className={filter === f ? "" : "secondary"}
              onClick={() => setFilter(f)}
              style={{ padding: "4px 10px", fontSize: 12 }}
            >
              {KIND_FILTER_LABELS[f]}
            </button>
          ))}
        </div>
        {err && <div className="error">{err}</div>}
      </div>

      {loading ? (
        <div className="card muted">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card muted">
          {assets.length === 0
            ? "No assets yet. Upload some above."
            : `No ${filter === "all" ? "" : KIND_LABELS[filter] + " "}assets match the current filter.`}
        </div>
      ) : (
        <div className="asset-grid">
          {filtered.map((a) => (
            <div key={a.assetId} className={`asset-tile${a.active ? "" : " inactive"}`}>
              <div className="asset-thumb">
                <img src={a.downloadUrl} alt={a.title} />
                <span className={`badge ${a.active ? "active" : "revoked"}`}>
                  {a.active ? "active" : "inactive"}
                </span>
                <span className="kind-tag">{a.kind}</span>
              </div>
              <div className="asset-meta">
                <button className="link-like" onClick={() => void renameAsset(a)} title="Rename">
                  {a.title}
                </button>
                <div className="row" style={{ gap: 6 }}>
                  <button className="secondary" onClick={() => void toggleActive(a)}>
                    {a.active ? "Hide" : "Show"}
                  </button>
                  <button className="danger" onClick={() => void deleteAsset(a)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Assets;
