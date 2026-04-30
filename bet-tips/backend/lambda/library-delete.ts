import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { buckets, ddb, tables, type LibraryAssetRecord, type UserRole } from "./shared/db";
import { principalFrom, requireAdmin } from "./shared/context";
import { bad, forbidden, noContent, notFound, unauthorized } from "./shared/http";

const s3 = new S3Client({});

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

  const assetId = event.pathParameters?.assetId;
  if (!assetId) return bad("assetId path param required");

  const got = await ddb.send(new GetCommand({ TableName: tables.library, Key: { assetId } }));
  const row = got.Item as LibraryAssetRecord | undefined;
  if (!row) return notFound();

  await ddb.send(new DeleteCommand({ TableName: tables.library, Key: { assetId } }));
  await s3
    .send(new DeleteObjectCommand({ Bucket: buckets.media, Key: row.s3Key }))
    .catch(() => undefined);

  return noContent();
};
