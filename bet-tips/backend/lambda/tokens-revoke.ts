import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables, type UserRole } from "./shared/db";
import { principalFrom, requireAdmin } from "./shared/context";
import { bad, forbidden, noContent, unauthorized } from "./shared/http";

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

  const token = event.pathParameters?.token;
  if (!token) return bad("token path param required");

  try {
    await ddb.send(
      new UpdateCommand({
        TableName: tables.tokens,
        Key: { token },
        UpdateExpression: "SET #s = :revoked",
        ConditionExpression: "#s = :active",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":revoked": "revoked", ":active": "active" },
      })
    );
  } catch {
    return bad("Token is not active and cannot be revoked", 409);
  }
  return noContent();
};
