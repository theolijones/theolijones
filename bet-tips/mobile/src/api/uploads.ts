import { api } from "./client";
import type { EdlBase } from "./edl";

export type VideoContentType = "video/mp4" | "video/quicktime" | "video/webm";
export type ImageAssetContentType = "image/png" | "image/jpeg" | "image/webp";

export interface CreateUploadResponse {
  uploadId: string;
  videoKey: string;
  videoUploadUrl: string;
  videoContentType: VideoContentType;
  expiresIn: number;
}

export interface AssetResponse {
  assetId: string;
  assetKey: string;
  uploadUrl: string;
  expiresIn: number;
}

export interface CompletedUpload {
  uploadId: string;
  status: "pending" | "approved" | "rejected";
  videoKey?: string;
  videoSizeBytes?: number;
}

export interface SubmitUploadArgs {
  videoUri: string;
  videoContentType?: VideoContentType;
  metadata?: Record<string, unknown>;
  edl?: EdlBase;
  assets?: { localUri: string; contentType: ImageAssetContentType; layerId: string }[];
  onProgress?: (fraction: number) => void;
}

const putWithProgress = (url: string, blob: Blob, contentType: string, onProgress?: (fraction: number) => void): Promise<void> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 PUT failed: ${xhr.status} ${xhr.responseText}`));
    };
    xhr.onerror = () => reject(new Error("S3 PUT network error"));
    xhr.send(blob);
  });

export const createUpload = (args: {
  metadata?: Record<string, unknown>;
  videoContentType?: VideoContentType;
}): Promise<CreateUploadResponse> =>
  api<CreateUploadResponse>("/uploads", {
    method: "POST",
    body: {
      metadata: args.metadata ?? {},
      videoContentType: args.videoContentType ?? "video/mp4",
    },
  });

export const requestAsset = (uploadId: string, contentType: ImageAssetContentType): Promise<AssetResponse> =>
  api<AssetResponse>(`/uploads/${uploadId}/assets`, {
    method: "POST",
    body: { contentType },
  });

export const completeUpload = (uploadId: string, edl?: EdlBase): Promise<CompletedUpload> =>
  api<CompletedUpload>(`/uploads/${uploadId}/complete`, {
    method: "POST",
    body: edl ? { edl } : {},
  });

export type RenderStatus = "not_required" | "queued" | "rendering" | "done" | "failed";

export interface MyUpload {
  uploadId: string;
  status: "pending" | "approved" | "rejected";
  renderStatus?: RenderStatus;
  renderedVideoUrl?: string;
  renderError?: string;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export const listMyUploads = (): Promise<{ uploads: MyUpload[] }> =>
  api<{ uploads: MyUpload[] }>("/uploads");

const uploadLocalFile = async (
  localUri: string,
  targetUrl: string,
  contentType: string
): Promise<void> => {
  const fileRes = await fetch(localUri);
  if (!fileRes.ok) throw new Error(`failed to read ${localUri}`);
  const blob = await fileRes.blob();
  await putWithProgress(targetUrl, blob, contentType);
};

export const submitUpload = async ({
  videoUri,
  videoContentType = "video/mp4",
  metadata,
  edl,
  assets = [],
  onProgress,
}: SubmitUploadArgs): Promise<CompletedUpload> => {
  const create = await createUpload({ metadata, videoContentType });

  // Upload assets first; collect layerId -> assetKey and swap into the EDL
  // before completing, since the renderer dereferences assetKey from the EDL.
  const layerIdToAssetKey = new Map<string, string>();
  for (const asset of assets) {
    const presign = await requestAsset(create.uploadId, asset.contentType);
    await uploadLocalFile(asset.localUri, presign.uploadUrl, asset.contentType);
    layerIdToAssetKey.set(asset.layerId, presign.assetKey);
  }

  const resolvedEdl = edl
    ? {
        ...edl,
        layers: edl.layers.map((l) =>
          l.type === "image" && layerIdToAssetKey.has(l.id)
            ? { ...l, assetKey: layerIdToAssetKey.get(l.id)! }
            : l
        ),
      }
    : undefined;

  const fileRes = await fetch(videoUri);
  if (!fileRes.ok) throw new Error(`failed to read video at ${videoUri}`);
  const blob = await fileRes.blob();
  await putWithProgress(create.videoUploadUrl, blob, videoContentType, onProgress);

  return completeUpload(create.uploadId, resolvedEdl);
};
