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

/**
 * A named, admin-authored metadata template attached to a user. `metadata` is a
 * complete, fixed COP metadata object uploaded as a JSON file — every field is
 * baked in. The only value filled at submit time is the Bet ID, which the app
 * writes into the BET_ID_FIELD_KEY key before shipping the JSON verbatim.
 */
export interface NamedTemplate {
  id: string;
  name: string;
  metadata: Record<string, unknown>;
}

export interface UserRecord {
  userId: string;
  role: UserRole;
  sportsbetUsername?: string;
  email?: string;
  passwordHash?: string;
  signupTokenUsed?: string;
  expoPushToken?: string;
  /** Talent assigned to this account (from the signup token). */
  talentId?: string;
  talentName?: string;
  talentInitials?: string;
  /** Admin-authored named metadata templates the talent picks from in the app. */
  metadataTemplates?: NamedTemplate[];
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
  /** Talent the redeeming account will be assigned. */
  talentId?: string;
  talentName?: string;
  talentInitials?: string;
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

export type FieldSource = "fixed" | "input" | "derived";
export type FieldControl = "text" | "number" | "boolean" | "date" | "select";
export type FieldCatalog = "sport" | "competition" | "tipType";
export type FieldDerivation = "talentOrShowList" | "genericContentType";

export interface MetadataSchemaField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "enum";
  required: boolean;
  options?: string[];
  helpText?: string;
  /** Where the value comes from. Absent ⇒ "input" (back-compat). */
  source?: FieldSource;
  /** source=fixed: constant emitted in every metadata file. */
  fixedValue?: string | number | boolean;
  /** source=input: how the app renders the field. Absent ⇒ derived from `type`. */
  control?: FieldControl;
  /** source=input & control=select: a code-backed catalog (else use `options`). */
  catalog?: FieldCatalog;
  /** source=input: whether the app shows this field. Absent ⇒ true. */
  exposed?: boolean;
  /** source=derived: which account-derived value to emit. */
  derived?: FieldDerivation;
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
