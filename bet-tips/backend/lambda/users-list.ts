import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables, type UserRecord, type UserRole } from "./shared/db";
import { principalFrom, requireAdmin } from "./shared/context";
import { forbidden, ok, unauthorized } from "./shared/http";

/**
 * GET /admin/users — list non-admin accounts with their assigned talent and
 * named metadata templates, so the admin can manage each user's templates.
 * The user base is small, so a Scan is acceptable (no list GSI on the table).
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

  const users: UserRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({ TableName: tables.users, ExclusiveStartKey: lastKey })
    );
    users.push(...((res.Items ?? []) as UserRecord[]));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  const list = users
    .filter((u) => u.role !== "admin")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((u) => ({
      userId: u.userId,
      sportsbetUsername: u.sportsbetUsername,
      email: u.email,
      talentId: u.talentId,
      talentName: u.talentName,
      talentInitials: u.talentInitials,
      metadataTemplates: u.metadataTemplates ?? [],
      createdAt: u.createdAt,
    }));

  return ok({ users: list });
};
