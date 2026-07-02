import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables, type TokenRecord, type UserRole } from "./shared/db";
import { principalFrom, requireAdmin } from "./shared/context";
import { bad, forbidden, notFound, ok, parseJson, unauthorized } from "./shared/http";

interface UpdateBody {
  note?: string | null;
  /** Pass all three to set a talent, or all empty/null to clear it. Omit to leave unchanged. */
  talentId?: string | null;
  talentName?: string | null;
  talentInitials?: string | null;
}

export const handler: APIGatewayProxyHandlerV2WithLambdaAuthorizer<{
  userId: string;
  role: UserRole;
}> = async (event) => {
  try {
    requireAdmin(principalFrom(event));
  } catch (e) {
    const err = e as Error & { statusCode?: number };
    return err.statusCode === 403 ? forbidden(err.message) : unauthorized();
  }

  const token = event.pathParameters?.token;
  if (!token) return bad("token path param required");

  let body: UpdateBody;
  try {
    body = parseJson<UpdateBody>(event.body);
  } catch (e) {
    return bad((e as Error).message);
  }

  const existing = await ddb.send(
    new GetCommand({ TableName: tables.tokens, Key: { token } })
  );
  const row = existing.Item as TokenRecord | undefined;
  if (!row) return notFound("token not found");
  if (row.status === "revoked") return bad("cannot edit a revoked token", 409);

  // Build SET/REMOVE clauses for the token row, tracking what changed so the
  // same change can be mirrored onto the redeeming user (for used tokens).
  const setParts: string[] = [];
  const removeParts: string[] = [];
  const values: Record<string, unknown> = {};

  if (body.note !== undefined) {
    const note = body.note?.toString().trim();
    if (note) {
      setParts.push("note = :note");
      values[":note"] = note;
    } else {
      removeParts.push("note");
    }
  }

  const talentTouched =
    body.talentId !== undefined ||
    body.talentName !== undefined ||
    body.talentInitials !== undefined;
  let talentFields: { talentId: string; talentName: string; talentInitials: string } | null = null;
  if (talentTouched) {
    const id = body.talentId?.toString().trim();
    const name = body.talentName?.toString().trim();
    const initials = body.talentInitials?.toString().trim().toUpperCase();
    if (!id && !name && !initials) {
      removeParts.push("talentId", "talentName", "talentInitials");
    } else if (id && name && initials) {
      talentFields = { talentId: id, talentName: name, talentInitials: initials };
      setParts.push("talentId = :tid", "talentName = :tname", "talentInitials = :tinit");
      values[":tid"] = id;
      values[":tname"] = name;
      values[":tinit"] = initials;
    } else {
      return bad("talentId, talentName and talentInitials must be provided together");
    }
  }

  if (setParts.length === 0 && removeParts.length === 0) return ok(row);

  let expr = "";
  if (setParts.length) expr += `SET ${setParts.join(", ")}`;
  if (removeParts.length) expr += `${expr ? " " : ""}REMOVE ${removeParts.join(", ")}`;

  const updated = await ddb.send(
    new UpdateCommand({
      TableName: tables.tokens,
      Key: { token },
      UpdateExpression: expr,
      ExpressionAttributeValues: setParts.length ? values : undefined,
      ReturnValues: "ALL_NEW",
    })
  );

  // For a token that's already been redeemed, mirror talent changes onto the
  // user so existing accounts pick them up immediately.
  if (row.status === "used" && row.usedBy && talentTouched) {
    const uSet: string[] = ["updatedAt = :ut"];
    const uRemove: string[] = [];
    const uValues: Record<string, unknown> = { ":ut": new Date().toISOString() };

    if (talentFields) {
      uSet.push("talentId = :tid", "talentName = :tname", "talentInitials = :tinit");
      uValues[":tid"] = talentFields.talentId;
      uValues[":tname"] = talentFields.talentName;
      uValues[":tinit"] = talentFields.talentInitials;
    } else {
      uRemove.push("talentId", "talentName", "talentInitials");
    }

    if (uSet.length > 1 || uRemove.length) {
      let uExpr = `SET ${uSet.join(", ")}`;
      if (uRemove.length) uExpr += ` REMOVE ${uRemove.join(", ")}`;
      await ddb.send(
        new UpdateCommand({
          TableName: tables.users,
          Key: { userId: row.usedBy },
          UpdateExpression: uExpr,
          ExpressionAttributeValues: uValues,
          ConditionExpression: "attribute_exists(userId)",
        })
      ).catch(() => {
        // User row may have been deleted; the token update still stands.
      });
    }
  }

  return ok(updated.Attributes);
};
