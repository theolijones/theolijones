import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  buckets,
  ddb,
  tables,
  type UploadRecord,
  type UserRole,
} from "./shared/db";
import { principalFrom } from "./shared/context";
import { bad, forbidden, notFound, ok, unauthorized } from "./shared/http";

const s3 = new S3Client({});

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

  const existing = await ddb.send(
    new GetCommand({ TableName: tables.uploads, Key: { uploadId } })
  );
  const record = existing.Item as UploadRecord | undefined;
  if (!record) return notFound("upload not found");
  if (record.userId !== p.userId) return forbidden("not your upload");

  if (record.status !== "draft") {
    // Idempotent: already completed or reviewed
    return ok({ uploadId, status: record.status });
  }

  let sizeBytes: number | undefined;
  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: buckets.media, Key: record.videoKey })
    );
    sizeBytes = head.ContentLength;
  } catch {
    return bad("video not yet uploaded to S3", 409);
  }

  const now = new Date().toISOString();
  const res = await ddb.send(
    new UpdateCommand({
      TableName: tables.uploads,
      Key: { uploadId },
      UpdateExpression:
        "SET #s = :pending, videoSizeBytes = :size, updatedAt = :t",
      ConditionExpression: "#s = :draft AND userId = :uid",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":pending": "pending",
        ":draft": "draft",
        ":size": sizeBytes ?? 0,
        ":t": now,
        ":uid": p.userId,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return ok(res.Attributes);
};
