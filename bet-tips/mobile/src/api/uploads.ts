import { api } from "./client";

export type VideoContentType = "video/mp4" | "video/quicktime" | "video/webm";

export interface CreateUploadResponse {
  uploadId: string;
  videoKey: string;
  videoUploadUrl: string;
  videoContentType: VideoContentType;
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
    body: { metadata: args.metadata ?? {}, videoContentType: args.videoContentType ?? "video/mp4" },
  });

export const completeUpload = (uploadId: string): Promise<CompletedUpload> =>
  api<CompletedUpload>(`/uploads/${uploadId}/complete`, { method: "POST", body: {} });

export const submitUpload = async ({
  videoUri,
  videoContentType = "video/mp4",
  metadata,
  onProgress,
}: SubmitUploadArgs): Promise<CompletedUpload> => {
  const create = await createUpload({ metadata, videoContentType });

  const fileRes = await fetch(videoUri);
  if (!fileRes.ok) throw new Error(`failed to read video at ${videoUri}`);
  const blob = await fileRes.blob();

  await putWithProgress(create.videoUploadUrl, blob, videoContentType, onProgress);
  return completeUpload(create.uploadId);
};
