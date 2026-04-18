import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";
import { ddb, tables, type UserRecord } from "./shared/db";
import { signAccess, signRefresh } from "./shared/jwt";
import { bad, ok, parseJson, unauthorized } from "./shared/http";

interface LoginBody {
  email: string;
  password: string;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let body: LoginBody;
  try {
    body = parseJson<LoginBody>(event.body);
  } catch (e) {
    return bad((e as Error).message);
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) return bad("email and password required");

  const res = await ddb.send(
    new QueryCommand({
      TableName: tables.users,
      IndexName: "byEmail",
      KeyConditionExpression: "email = :e",
      ExpressionAttributeValues: { ":e": email },
      Limit: 1,
    })
  );

  const user = res.Items?.[0] as UserRecord | undefined;
  if (!user || !user.passwordHash) return unauthorized("Invalid email or password");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return unauthorized("Invalid email or password");

  const accessToken = await signAccess(user.userId, user.role);
  const refreshToken = await signRefresh(user.userId, user.role);

  return ok({
    user: { userId: user.userId, role: user.role, email: user.email },
    accessToken,
    refreshToken,
  });
};
