import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import {
  buckets,
  ddb,
  tables,
  type UploadRecord,
  type UserRole,
} from "./shared/db";
import { principalFrom } from "./shared/context";
import { bad, created, parseJson, unauthorized } from "./shared/http";

const s3 = new S3Client({});

interface CreateBody {
  metadata?: Record<string, unknown>;
  videoContentType?: string;
}

const ALLOWED_CONTENT_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export const handler: APIGatewayProxyHandlerV2WithLambdaAuthorizer<{
  userId: string;
  role: UserRole;
}> = async (event) => {
  let p;
  try {
    p = principalFrom(event);
  } catch {
    return unauthorized();
  }

  let body: CreateBody;
  try {
    body = parseJson<CreateBody>(event.body);
  } catch (e) {
    return bad((e as Error).message);
  }

  const contentType = body.videoContentType ?? "video/mp4";
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return bad(`videoContentType must be one of ${[...ALLOWED_CONTENT_TYPES].join(", ")}`);
  }

  const metadata = body.metadata ?? {};
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    return bad("metadata must be an object");
  }

  const uploadId = randomUUID();
  const now = new Date().toISOString();
  const ext =
    contentType === "video/quicktime" ? "mov" : contentType === "video/webm" ? "webm" : "mp4";
  const videoKey = `uploads/${p.userId}/${uploadId}/video.${ext}`;

  const record: UploadRecord = {
    uploadId,
    userId: p.userId,
    status: "draft",
    videoKey,
    videoContentType: contentType,
    metadata: metadata as Record<string, unknown>,
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: tables.uploads,
      Item: record,
      ConditionExpression: "attribute_not_exists(uploadId)",
    })
  );

  const videoUploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: buckets.media,
      Key: videoKey,
      ContentType: contentType,
    }),
    { expiresIn: 900 }
  );

  return created({
    uploadId,
    videoKey,
    videoUploadUrl,
    videoContentType: contentType,
    expiresIn: 900,
  });
};
