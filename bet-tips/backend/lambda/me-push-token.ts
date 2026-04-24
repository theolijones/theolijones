import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables, type UserRole } from "./shared/db";
import { principalFrom } from "./shared/context";
import { bad, noContent, parseJson, unauthorized } from "./shared/http";

interface TokenBody {
  token: string | null;
}

// Expo push tokens look like "ExponentPushToken[...]". We accept either
// an explicit null/empty string to clear, or a valid-looking token to set.
const isValidToken = (t: string): boolean =>
  t.startsWith("ExponentPushToken[") && t.endsWith("]");

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

  let body: TokenBody;
  try {
    body = parseJson<TokenBody>(event.body);
  } catch (e) {
    return bad((e as Error).message);
  }

  const now = new Date().toISOString();
  const raw = body.token;
  const clearing = raw === null || raw === "";

  if (!clearing && (typeof raw !== "string" || !isValidToken(raw))) {
    return bad("token must be an Expo push token or null");
  }

  await ddb.send(
    new UpdateCommand({
      TableName: tables.users,
      Key: { userId: p.userId },
      UpdateExpression: clearing
        ? "REMOVE expoPushToken SET updatedAt = :t"
        : "SET expoPushToken = :p, updatedAt = :t",
      ExpressionAttributeValues: clearing
        ? { ":t": now }
        : { ":p": raw, ":t": now },
    })
  );

  return noContent();
};
