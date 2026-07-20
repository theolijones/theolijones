import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { ddb, tables, type UserRecord, type UserRole } from "./shared/db";
import { hashPassword, normaliseEmail, validatePassword } from "./shared/passwords";
import { principalFrom, requireAdmin } from "./shared/context";
import { bad, conflict, created, forbidden, parseJson, unauthorized } from "./shared/http";

interface Body {
  email?: unknown;
  password?: unknown;
}

/**
 * POST /admin/admins — create another admin console account. Mirrors what
 * `scripts/seed-admin.ts` does for the first admin, so the bootstrap script and
 * this endpoint produce identical records.
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

  let body: Body;
  try {
    body = parseJson<Body>(event.body);
  } catch (e) {
    return bad((e as Error).message);
  }

  let email: string;
  let password: string;
  try {
    email = normaliseEmail(body.email);
    password = validatePassword(body.password);
  } catch (e) {
    return bad((e as Error).message);
  }

  // Login resolves accounts through the byEmail GSI, so a duplicate email would
  // make which account you land on non-deterministic.
  const existing = await ddb.send(
    new QueryCommand({
      TableName: tables.users,
      IndexName: "byEmail",
      KeyConditionExpression: "email = :e",
      ExpressionAttributeValues: { ":e": email },
      Limit: 1,
    })
  );
  if (existing.Items?.length) return conflict("an account with that email already exists");

  const now = new Date().toISOString();
  const user: UserRecord = {
    userId: randomUUID(),
    role: "admin",
    email,
    passwordHash: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: tables.users,
      Item: user,
      // Belt and braces against a UUID collision clobbering an existing account.
      ConditionExpression: "attribute_not_exists(userId)",
    })
  );

  return created({
    admin: { userId: user.userId, email: user.email, createdAt: now, updatedAt: now },
  });
};
