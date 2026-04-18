import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  ddb,
  tables,
  type MetadataSchemaField,
  type MetadataSchemaRecord,
  type UserRole,
} from "./shared/db";
import { principalFrom, requireAdmin } from "./shared/context";
import { bad, forbidden, ok, parseJson, unauthorized } from "./shared/http";

interface UpdateBody {
  fields: MetadataSchemaField[];
}

const VALID_TYPES = new Set(["string", "number", "boolean", "enum"]);

const validateFields = (fields: MetadataSchemaField[]): string | null => {
  if (!Array.isArray(fields)) return "fields must be an array";
  const seen = new Set<string>();
  for (const f of fields) {
    if (!f.key || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(f.key)) {
      return `Invalid field key: ${f.key}`;
    }
    if (seen.has(f.key)) return `Duplicate field key: ${f.key}`;
    seen.add(f.key);
    if (!f.label) return `Missing label for ${f.key}`;
    if (!VALID_TYPES.has(f.type)) return `Invalid type for ${f.key}`;
    if (typeof f.required !== "boolean") return `required must be boolean for ${f.key}`;
    if (f.type === "enum" && (!f.options || f.options.length === 0)) {
      return `enum field ${f.key} must have options`;
    }
  }
  return null;
};

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

  let body: UpdateBody;
  try {
    body = parseJson<UpdateBody>(event.body);
  } catch (e) {
    return bad((e as Error).message);
  }

  const problem = validateFields(body.fields);
  if (problem) return bad(problem);

  const row: MetadataSchemaRecord = {
    schemaId: "current",
    fields: body.fields,
    updatedAt: new Date().toISOString(),
    updatedBy: p.userId,
  };

  await ddb.send(new PutCommand({ TableName: tables.schema, Item: row }));
  return ok(row);
};
