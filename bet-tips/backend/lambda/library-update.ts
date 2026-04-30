import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables, type LibraryAssetRecord, type UserRole } from "./shared/db";
import { principalFrom, requireAdmin } from "./shared/context";
import { bad, forbidden, ok, parseJson, unauthorized } from "./shared/http";

interface UpdateBody {
  title?: string;
  active?: boolean;
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

  const assetId = event.pathParameters?.assetId;
  if (!assetId) return bad("assetId path param required");

  let body: UpdateBody;
  try {
    body = parseJson<UpdateBody>(event.body);
  } catch (e) {
    return bad((e as Error).message);
  }

  const sets: string[] = ["updatedAt = :t"];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = { ":t": new Date().toISOString() };

  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t) return bad("title cannot be empty");
    sets.push("title = :title");
    values[":title"] = t;
  }

  if (typeof body.active === "boolean") {
    sets.push("#a = :active");
    names["#a"] = "active";
    values[":active"] = body.active ? "true" : "false";
  }

  if (sets.length === 1) return bad("nothing to update");

  const res = await ddb.send(
    new UpdateCommand({
      TableName: tables.library,
      Key: { assetId },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ConditionExpression: "attribute_exists(assetId)",
      ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    })
  );

  const updated = res.Attributes as LibraryAssetRecord | undefined;
  if (!updated) return bad("not found", 404);
  return ok({
    assetId: updated.assetId,
    kind: updated.kind,
    title: updated.title,
    contentType: updated.contentType,
    active: updated.active === "true",
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
};
