import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { ddb, tables, type TokenRecord, type UserRecord } from "./shared/db";
import { signAccess, signRefresh } from "./shared/jwt";
import { bad, conflict, created, parseJson } from "./shared/http";

interface SignupBody {
  sportsbetUsername: string;
  signupToken: string;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let body: SignupBody;
  try {
    body = parseJson<SignupBody>(event.body);
  } catch (e) {
    return bad((e as Error).message);
  }

  const sportsbetUsername = body.sportsbetUsername?.trim();
  const signupToken = body.signupToken?.trim();
  if (!sportsbetUsername || !signupToken) {
    return bad("sportsbetUsername and signupToken are required");
  }

  const tokenRes = await ddb.send(
    new GetCommand({ TableName: tables.tokens, Key: { token: signupToken } })
  );
  const tokenRow = tokenRes.Item as TokenRecord | undefined;
  if (!tokenRow) return bad("Invalid signup token", 401);
  if (tokenRow.status !== "active") return bad("Signup token is no longer active", 401);
  if (tokenRow.expiresAt && tokenRow.expiresAt < new Date().toISOString()) {
    return bad("Signup token has expired", 401);
  }

  const userId = randomUUID();
  const now = new Date().toISOString();

  const user: UserRecord = {
    userId,
    role: "user",
    sportsbetUsername,
    signupTokenUsed: signupToken,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await ddb.send(
      new PutCommand({
        TableName: tables.users,
        Item: user,
        ConditionExpression: "attribute_not_exists(userId)",
      })
    );
  } catch {
    return conflict("User already exists");
  }

  try {
    await ddb.send(
      new UpdateCommand({
        TableName: tables.tokens,
        Key: { token: signupToken },
        UpdateExpression: "SET #s = :used, usedBy = :u, usedAt = :t",
        ConditionExpression: "#s = :active",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":used": "used",
          ":active": "active",
          ":u": userId,
          ":t": now,
        },
      })
    );
  } catch {
    return conflict("Signup token was consumed by another request");
  }

  const accessToken = await signAccess(userId, "user");
  const refreshToken = await signRefresh(userId, "user");

  return created({
    user: { userId, role: user.role, sportsbetUsername },
    accessToken,
    refreshToken,
  });
};
