import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import {
  buckets,
  ddb,
  tables,
  type LibraryAssetKind,
  type LibraryAssetRecord,
  type UserRole,
} from "./shared/db";
import { principalFrom, requireAdmin } from "./shared/context";
import { bad, created, forbidden, parseJson, unauthorized } from "./shared/http";

const s3 = new S3Client({});
const URL_TTL = 900;

const ALLOWED_KINDS: ReadonlySet<LibraryAssetKind> = new Set([
  "sticker",
  "image",
  "gif",
  "background",
]);
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

interface CreateBody {
  kind: LibraryAssetKind;
  title: string;
  contentType: string;
}

export const handler: APIGatewayProxyHandlerV2WithLambdaAuthorizer<{
  userId: string;
  role: UserRole;
}> = async (event) => {
  let p;
  try {
    p = principalFrom(event);
    requireAdmin(p);
  } catch (e) {
    const err = e as Error & { statusCode?: number };
    return err.statusCode === 403 ? forbidden(err.message) : unauthorized();
  }

  let body: CreateBody;
  try {
    body = parseJson<CreateBody>(event.body);
  } catch (e) {
    return bad((e as Error).message);
  }

  const title = body.title?.trim();
  if (!title) return bad("title is required");
  if (!ALLOWED_KINDS.has(body.kind)) {
    return bad("kind must be sticker, image, gif, or background");
  }
  const ext = ALLOWED_TYPES[body.contentType];
  if (!ext) return bad(`contentType must be one of ${Object.keys(ALLOWED_TYPES).join(", ")}`);
  if (body.kind === "gif" && body.contentType !== "image/gif") {
    return bad("kind 'gif' requires contentType image/gif");
  }
  if (body.kind === "background" && body.contentType === "image/gif") {
    return bad("kind 'background' does not accept image/gif");
  }

  const assetId = randomUUID();
  const s3Key = `library/${assetId}.${ext}`;
  const now = new Date().toISOString();

  const record: LibraryAssetRecord = {
    assetId,
    kind: body.kind,
    title,
    s3Key,
    contentType: body.contentType,
    active: "true",
    createdAt: now,
    updatedAt: now,
    createdBy: p.userId,
  };

  await ddb.send(new PutCommand({ TableName: tables.library, Item: record }));

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: buckets.media,
      Key: s3Key,
      ContentType: body.contentType,
    }),
    { expiresIn: URL_TTL }
  );

  return created({
    assetId,
    kind: record.kind,
    title: record.title,
    contentType: record.contentType,
    active: true,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    uploadUrl,
    uploadUrlExpiresIn: URL_TTL,
  });
};
