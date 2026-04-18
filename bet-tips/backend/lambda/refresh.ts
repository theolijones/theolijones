import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables, type UserRecord } from "./shared/db";
import { signAccess, signRefresh, verifyRefresh } from "./shared/jwt";
import { bad, ok, parseJson, unauthorized } from "./shared/http";

interface RefreshBody {
  refreshToken: string;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let body: RefreshBody;
  try {
    body = parseJson<RefreshBody>(event.body);
  } catch (e) {
    return bad((e as Error).message);
  }

  if (!body.refreshToken) return bad("refreshToken required");

  let claims;
  try {
    claims = await verifyRefresh(body.refreshToken);
  } catch {
    return unauthorized("Invalid refresh token");
  }

  const res = await ddb.send(
    new GetCommand({ TableName: tables.users, Key: { userId: claims.sub } })
  );
  const user = res.Item as UserRecord | undefined;
  if (!user) return unauthorized("User no longer exists");

  const accessToken = await signAccess(user.userId, user.role);
  const refreshToken = await signRefresh(user.userId, user.role);
  return ok({ accessToken, refreshToken });
};
