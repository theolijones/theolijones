import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables, type UserRecord, type UserRole } from "./shared/db";
import { principalFrom, requireAdmin } from "./shared/context";
import { forbidden, ok, unauthorized } from "./shared/http";

/**
 * GET /admin/admins — list admin console accounts. Talent accounts are excluded:
 * they authenticate with a signup token and have no password, so they are managed
 * from the Signup Tokens page instead.
 *
 * Never returns passwordHash.
 */
export const handler: APIGatewayProxyHandlerV2WithLambdaAuthorizer<{
  userId: string;
  role: UserRole;
}> = async (event) => {
  let principal;
  try {
    principal = principalFrom(event);
    requireAdmin(principal);
  } catch (e) {
    const err = e as Error & { statusCode?: number };
    return err.statusCode === 403 ? forbidden(err.message) : unauthorized();
  }

  const users: UserRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({ TableName: tables.users, ExclusiveStartKey: lastKey })
    );
    users.push(...((res.Items ?? []) as UserRecord[]));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  const admins = users
    .filter((u) => u.role === "admin")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((u) => ({
      userId: u.userId,
      email: u.email,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      /** Lets the UI mark "you" and avoid offering self-destructive actions. */
      isSelf: u.userId === principal.userId,
    }));

  return ok({ admins });
};
