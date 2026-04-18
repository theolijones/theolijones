import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables, type MetadataSchemaRecord, type UserRole } from "./shared/db";
import { principalFrom } from "./shared/context";
import { ok, unauthorized } from "./shared/http";

const DEFAULT_FIELDS: MetadataSchemaRecord["fields"] = [
  { key: "sportsbetUsername", label: "Sportsbet Username", type: "string", required: true },
  { key: "shareId", label: "Bet Share ID", type: "string", required: true },
  { key: "eventName", label: "Event Name", type: "string", required: false },
  { key: "selection", label: "Selection", type: "string", required: false },
  { key: "odds", label: "Odds", type: "number", required: false },
];

export const handler: APIGatewayProxyHandlerV2WithLambdaAuthorizer<{
  userId: string;
  role: UserRole;
}> = async (event) => {
  try {
    principalFrom(event);
  } catch {
    return unauthorized();
  }

  const res = await ddb.send(
    new GetCommand({ TableName: tables.schema, Key: { schemaId: "current" } })
  );
  if (res.Item) return ok(res.Item);

  return ok({
    schemaId: "current",
    fields: DEFAULT_FIELDS,
    updatedAt: new Date(0).toISOString(),
    updatedBy: "default",
  });
};
