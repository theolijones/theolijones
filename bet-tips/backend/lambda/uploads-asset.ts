import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import {
  buckets,
  ddb,
  tables,
  type UploadAsset,
  type UploadRecord,
  type UserRole,
} from "./shared/db";
import { principalFrom } from "./shared/context";
import {
  bad,
  created,
  forbidden,
  notFound,
  parseJson,
  unauthorized,
} from "./shared/http";

const s3 = new S3Client({});

interface AssetBody {
  contentType: string;
}

const ALLOWED_ASSET_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const extFor = (contentType: string): string =>
  contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";

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

  const uploadId = event.pathParameters?.uploadId;
  if (!uploadId) return bad("uploadId path param required");

  let body: AssetBody;
  try {
    body = parseJson<AssetBody>(event.body);
  } catch (e) {
    return bad((e as Error).message);
  }

  if (!ALLOWED_ASSET_TYPES.has(body.contentType)) {
    return bad(`contentType must be one of ${[...ALLOWED_ASSET_TYPES].join(", ")}`);
  }

  const existing = await ddb.send(
    new GetCommand({ TableName: tables.uploads, Key: { uploadId } })
  );
  const record = existing.Item as UploadRecord | undefined;
  if (!record) return notFound("upload not found");
  if (record.userId !== p.userId) return forbidden("not your upload");
  if (record.status !== "draft") return bad("assets can only be added to drafts", 409);

  const assetId = randomUUID();
  const assetKey = `uploads/${p.userId}/${uploadId}/assets/${assetId}.${extFor(body.contentType)}`;

  const newAsset: UploadAsset = {
    assetId,
    assetKey,
    contentType: body.contentType,
  };

  await ddb.send(
    new UpdateCommand({
      TableName: tables.uploads,
      Key: { uploadId },
      UpdateExpression:
        "SET assets = list_append(if_not_exists(assets, :empty), :new), updatedAt = :t",
      ConditionExpression: "userId = :uid AND #s = :draft",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":empty": [],
        ":new": [newAsset],
        ":t": new Date().toISOString(),
        ":uid": p.userId,
        ":draft": "draft",
      },
    })
  );

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: buckets.media,
      Key: assetKey,
      ContentType: body.contentType,
    }),
    { expiresIn: 900 }
  );

  return created({ assetId, assetKey, uploadUrl, expiresIn: 900 });
};
