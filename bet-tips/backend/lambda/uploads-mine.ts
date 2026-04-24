import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  buckets,
  ddb,
  tables,
  type UploadRecord,
  type UserRole,
} from "./shared/db";
import { principalFrom } from "./shared/context";
import { ok, unauthorized } from "./shared/http";

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

  const res = await ddb.send(
    new QueryCommand({
      TableName: tables.uploads,
      IndexName: "byUser",
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": p.userId },
      ScanIndexForward: false,
      Limit: 50,
    })
  );

  const items = (res.Items ?? []) as UploadRecord[];
  // Only surface submissions the user has actually completed
  const visible = items.filter((u) => u.status !== "draft");

  const withUrls = await Promise.all(
    visible.map(async (u) => {
      let renderedVideoUrl: string | undefined;
      if (u.renderStatus === "done" && u.renderedVideoKey) {
        renderedVideoUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: buckets.media, Key: u.renderedVideoKey }),
          { expiresIn: 3600 }
        );
      }
      return { ...u, renderedVideoUrl };
    })
  );

  return ok({ uploads: withUrls });
};
