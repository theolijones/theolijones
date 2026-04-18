import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables, type UserRole } from "./shared/db";
import { principalFrom, requireAdmin } from "./shared/context";
import { bad, forbidden, ok, parseJson, unauthorized } from "./shared/http";

interface ReviewBody {
  decision: "approved" | "rejected";
  note?: string;
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

  const uploadId = event.pathParameters?.uploadId;
  if (!uploadId) return bad("uploadId path param required");

  let body: ReviewBody;
  try {
    body = parseJson<ReviewBody>(event.body);
  } catch (e) {
    return bad((e as Error).message);
  }

  if (body.decision !== "approved" && body.decision !== "rejected") {
    return bad("decision must be 'approved' or 'rejected'");
  }
  if (body.decision === "rejected" && !body.note?.trim()) {
    return bad("note required when rejecting");
  }

  const now = new Date().toISOString();
  const res = await ddb.send(
    new UpdateCommand({
      TableName: tables.uploads,
      Key: { uploadId },
      UpdateExpression:
        "SET #s = :s, reviewNote = :n, reviewedBy = :b, reviewedAt = :t, updatedAt = :t",
      ConditionExpression: "#s = :pending",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":s": body.decision,
        ":n": body.note ?? null,
        ":b": p.userId,
        ":t": now,
        ":pending": "pending",
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return ok(res.Attributes);
};
