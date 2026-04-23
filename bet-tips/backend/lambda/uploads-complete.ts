import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import {
  buckets,
  ddb,
  tables,
  type UploadRecord,
  type UserRole,
} from "./shared/db";
import { edlHasLayers, isValidEdl, type EdlBase } from "./shared/edl";
import { principalFrom } from "./shared/context";
import { bad, forbidden, notFound, ok, parseJson, unauthorized } from "./shared/http";

const s3 = new S3Client({});
const lambdaClient = new LambdaClient({});
const RENDER_FN = process.env.RENDER_FN_NAME;

interface CompleteBody {
  edl?: EdlBase;
}

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

  let body: CompleteBody = {};
  if (event.body) {
    try {
      body = parseJson<CompleteBody>(event.body);
    } catch (e) {
      return bad((e as Error).message);
    }
  }

  if (body.edl !== undefined && !isValidEdl(body.edl)) {
    return bad("edl must be { width, height, durationMs, layers[] }");
  }

  const existing = await ddb.send(
    new GetCommand({ TableName: tables.uploads, Key: { uploadId } })
  );
  const record = existing.Item as UploadRecord | undefined;
  if (!record) return notFound("upload not found");
  if (record.userId !== p.userId) return forbidden("not your upload");

  if (record.status !== "draft") {
    return ok({ uploadId, status: record.status });
  }

  const edl = body.edl;
  const willRender = edlHasLayers(edl);

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
  const sets = ["#s = :pending", "videoSizeBytes = :size", "updatedAt = :t", "renderStatus = :rs"];
  const values: Record<string, unknown> = {
    ":pending": "pending",
    ":draft": "draft",
    ":size": sizeBytes ?? 0,
    ":t": now,
    ":uid": p.userId,
    ":rs": willRender ? "queued" : "not_required",
  };
  if (edl) {
    sets.push("edl = :edl");
    values[":edl"] = edl;
  }

  const res = await ddb.send(
    new UpdateCommand({
      TableName: tables.uploads,
      Key: { uploadId },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ConditionExpression: "#s = :draft AND userId = :uid",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    })
  );

  if (willRender && RENDER_FN) {
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: RENDER_FN,
        InvocationType: "Event",
        Payload: Buffer.from(JSON.stringify({ uploadId })),
      })
    );
  }

  return ok(res.Attributes);
};
