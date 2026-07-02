import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables, type NamedTemplate, type UserRole } from "./shared/db";
import { parseNamedTemplates } from "./shared/metadata";
import { principalFrom, requireAdmin } from "./shared/context";
import { bad, forbidden, notFound, ok, parseJson, unauthorized } from "./shared/http";

interface Body {
  /** Full replacement set of the user's named templates. */
  templates?: unknown;
}

/**
 * PUT /admin/users/{userId}/templates — replace the whole named-template array
 * on a user. Create/rename/edit/delete are all expressed by saving the desired
 * final array. An empty array clears all templates.
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

  let templates: NamedTemplate[];
  try {
    templates = parseNamedTemplates(body.templates);
  } catch (e) {
    return bad((e as Error).message);
  }

  try {
    const updated = await ddb.send(
      new UpdateCommand({
        TableName: tables.users,
        Key: { userId },
        UpdateExpression: "SET metadataTemplates = :t, updatedAt = :u",
        ConditionExpression: "attribute_exists(userId)",
        ExpressionAttributeValues: {
          ":t": templates,
          ":u": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
    );
    return ok({ templates: (updated.Attributes as { metadataTemplates?: NamedTemplate[] })?.metadataTemplates ?? [] });
  } catch (e) {
    if ((e as { name?: string }).name === "ConditionalCheckFailedException") {
      return notFound("user not found");
    }
    throw e;
  }
};
