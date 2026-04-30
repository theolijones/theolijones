import { api } from "./client";

export type LibraryAssetKind = "sticker" | "image" | "gif" | "background";

export interface LibraryAsset {
  assetId: string;
  kind: LibraryAssetKind;
  title: string;
  contentType: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  s3Key: string;
  downloadUrl: string;
  downloadUrlExpiresIn: number;
}

export const listLibraryAssets = (): Promise<{ assets: LibraryAsset[] }> =>
  api<{ assets: LibraryAsset[] }>("/library/assets");
