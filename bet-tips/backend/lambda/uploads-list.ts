import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buckets, ddb, tables, type UploadRecord, type UploadStatus, type UserRole } from "./shared/db";
import { principalFrom, requireAdmin } from "./shared/context";
import { forbidden, ok, unauthorized } from "./shared/http";

const s3 = new S3Client({});

const VALID_STATUSES: UploadStatus[] = ["pending", "approved", "rejected"];

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

  const status = (event.queryStringParameters?.status as UploadStatus) ?? "pending";
  if (!VALID_STATUSES.includes(status)) return ok({ uploads: [] });

  const res = await ddb.send(
    new QueryCommand({
      TableName: tables.uploads,
      IndexName: "byStatus",
      KeyConditionExpression: "#s = :s",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": status },
      ScanIndexForward: false,
      Limit: 100,
    })
  );

  const items = (res.Items ?? []) as UploadRecord[];
  const withUrls = await Promise.all(
    items.map(async (u) => {
      const videoUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: buckets.media, Key: u.videoKey }),
        { expiresIn: 3600 }
      );
      let renderedVideoUrl: string | undefined;
      if (u.renderedVideoKey && u.renderStatus === "done") {
        renderedVideoUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: buckets.media, Key: u.renderedVideoKey }),
          { expiresIn: 3600 }
        );
      }
      return { ...u, videoUrl, renderedVideoUrl };
    })
  );

  return ok({ uploads: withUrls });
};
