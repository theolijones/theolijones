import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables, type UserRecord, type UserRole } from "./shared/db";
import { hashPassword, validatePassword } from "./shared/passwords";
import { principalFrom, requireAdmin } from "./shared/context";
import { bad, forbidden, noContent, notFound, parseJson, unauthorized } from "./shared/http";

interface Body {
  password?: unknown;
}

/**
 * PUT /admin/admins/{userId}/password — set an admin's password. Used both for
 * resetting a colleague's forgotten password and for changing your own.
 *
 * Only applies to admin accounts: talent accounts have no password (they sign up
 * with a token), so setting one would create a credential nothing can use.
 */
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

  const userId = event.pathParameters?.userId;
  if (!userId) return bad("userId path param required");

  let body: Body;
  try {
    body = parseJson<Body>(event.body);
  } catch (e) {
    return bad((e as Error).message);
  }

  let password: string;
  try {
    password = validatePassword(body.password);
  } catch (e) {
    return bad((e as Error).message);
  }

  const res = await ddb.send(
    new GetCommand({ TableName: tables.users, Key: { userId } })
  );
  const target = res.Item as UserRecord | undefined;
  if (!target) return notFound("user not found");
  if (target.role !== "admin") {
    return bad("only admin accounts have passwords; talent sign up with a token");
  }

  await ddb.send(
    new UpdateCommand({
      TableName: tables.users,
      Key: { userId },
      UpdateExpression: "SET passwordHash = :p, updatedAt = :u",
      ConditionExpression: "attribute_exists(userId)",
      ExpressionAttributeValues: {
        ":p": await hashPassword(password),
        ":u": new Date().toISOString(),
      },
    })
  );

  // No body: never echo the password or the hash back.
  return noContent();
};
