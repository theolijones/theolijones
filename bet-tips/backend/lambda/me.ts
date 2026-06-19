import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables, type UserRecord, type UserRole } from "./shared/db";
import { principalFrom } from "./shared/context";
import { notFound, ok, unauthorized } from "./shared/http";

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
  const res = await ddb.send(new GetCommand({ TableName: tables.users, Key: { userId: p.userId } }));
  const user = res.Item as UserRecord | undefined;
  if (!user) return notFound("User not found");
  return ok({
    userId: user.userId,
    role: user.role,
    email: user.email,
    sportsbetUsername: user.sportsbetUsername,
    talentId: user.talentId,
    talentName: user.talentName,
    talentInitials: user.talentInitials,
    createdAt: user.createdAt,
  });
};
