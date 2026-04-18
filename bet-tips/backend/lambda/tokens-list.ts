import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables, type TokenRecord, type UserRole } from "./shared/db";
import { principalFrom, requireAdmin } from "./shared/context";
import { forbidden, ok, unauthorized } from "./shared/http";

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

  const status = event.queryStringParameters?.status;
  if (status && !["active", "used", "revoked"].includes(status)) {
    return ok({ tokens: [] });
  }

  if (status) {
    const res = await ddb.send(
      new QueryCommand({
        TableName: tables.tokens,
        IndexName: "byStatus",
        KeyConditionExpression: "#s = :s",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":s": status },
        ScanIndexForward: false,
        Limit: 200,
      })
    );
    return ok({ tokens: (res.Items ?? []) as TokenRecord[] });
  }

  const collected: TokenRecord[] = [];
  for (const s of ["active", "used", "revoked"] as const) {
    const res = await ddb.send(
      new QueryCommand({
        TableName: tables.tokens,
        IndexName: "byStatus",
        KeyConditionExpression: "#s = :s",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":s": s },
        ScanIndexForward: false,
        Limit: 200,
      })
    );
    collected.push(...((res.Items ?? []) as TokenRecord[]));
  }
  collected.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  return ok({ tokens: collected });
};
