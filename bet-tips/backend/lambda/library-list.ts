import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  buckets,
  ddb,
  tables,
  type LibraryAssetRecord,
  type UserRole,
} from "./shared/db";
import { principalFrom } from "./shared/context";
import { ok, unauthorized } from "./shared/http";

const s3 = new S3Client({});
const URL_TTL = 900;

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

  const includeInactive = p.role === "admin" && event.queryStringParameters?.all === "1";

  let items: LibraryAssetRecord[];
  if (includeInactive) {
    const res = await ddb.send(new ScanCommand({ TableName: tables.library, Limit: 500 }));
    items = (res.Items ?? []) as LibraryAssetRecord[];
  } else {
    const res = await ddb.send(
      new QueryCommand({
        TableName: tables.library,
        IndexName: "byActive",
        KeyConditionExpression: "#a = :a",
        ExpressionAttributeNames: { "#a": "active" },
        ExpressionAttributeValues: { ":a": "true" },
        ScanIndexForward: false,
        Limit: 500,
      })
    );
    items = (res.Items ?? []) as LibraryAssetRecord[];
  }

  const assets = await Promise.all(
    items.map(async (a) => {
      const downloadUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: buckets.media, Key: a.s3Key }),
        { expiresIn: URL_TTL }
      );
      return {
        assetId: a.assetId,
        kind: a.kind,
        title: a.title,
        contentType: a.contentType,
        active: a.active === "true",
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        s3Key: a.s3Key,
        downloadUrl,
        downloadUrlExpiresIn: URL_TTL,
      };
    })
  );

  assets.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  return ok({ assets });
};
