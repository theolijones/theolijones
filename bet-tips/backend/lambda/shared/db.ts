import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const raw = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(raw, {
  marshallOptions: { removeUndefinedValues: true },
});

export const tables = {
  users: process.env.USERS_TABLE!,
  tokens: process.env.TOKENS_TABLE!,
  uploads: process.env.UPLOADS_TABLE!,
  schema: process.env.SCHEMA_TABLE!,
  library: process.env.LIBRARY_TABLE!,
};

export const buckets = {
  media: process.env.MEDIA_BUCKET!,
};

export type UserRole = "admin" | "user";

export interface UserRecord {
  userId: string;
  role: UserRole;
  sportsbetUsername?: string;
  email?: string;
  passwordHash?: string;
  signupTokenUsed?: string;
  expoPushToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TokenRecord {
  token: string;
  status: "active" | "used" | "revoked";
  note?: string;
  issuedBy: string;
  usedBy?: string;
  usedAt?: string;
  createdAt: string;
  expiresAt?: string;
}

export type UploadStatus = "draft" | "pending" | "approved" | "rejected";

export type RenderStatus = "not_required" | "queued" | "rendering" | "done" | "failed";

export interface UploadAsset {
  assetId: string;
  assetKey: string;
  contentType: string;
}

export interface UploadRecord {
  uploadId: string;
  userId: string;
  status: UploadStatus;
  videoKey: string;
  videoContentType?: string;
  videoSizeBytes?: number;
  metadata: Record<string, unknown>;
  edl?: import("./edl").EdlBase;
  assets?: UploadAsset[];
  renderStatus?: RenderStatus;
  renderedVideoKey?: string;
  renderError?: string;
  renderStartedAt?: string;
  renderCompletedAt?: string;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetadataSchemaField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "enum";
  required: boolean;
  options?: string[];
  helpText?: string;
}

export interface MetadataSchemaRecord {
  schemaId: "current";
  fields: MetadataSchemaField[];
  updatedAt: string;
  updatedBy: string;
}

export type LibraryAssetKind = "sticker" | "image" | "gif" | "background";

export interface LibraryAssetRecord {
  assetId: string;
  kind: LibraryAssetKind;
  title: string;
  s3Key: string;
  contentType: string;
  active: "true" | "false";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
