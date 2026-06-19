import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables, type MetadataSchemaRecord, type UserRole } from "./shared/db";
import { principalFrom } from "./shared/context";
import { ok, unauthorized } from "./shared/http";

// COP video-metadata sidecar. fixed = constant; input = talent fills in
// (exposed in app); derived = computed from the account talent.
const DEFAULT_FIELDS: MetadataSchemaRecord["fields"] = [
  { key: "AssetClass", label: "Asset Class", type: "string", required: true, source: "fixed", fixedValue: "Bulletin" },
  { key: "FeedTipId", label: "Bet ID", type: "string", required: true, source: "input", control: "text", exposed: true },
  { key: "GenericContentType", label: "Generic Content Type", type: "string", required: true, source: "derived", derived: "genericContentType" },
  { key: "TalentOrShowList", label: "Talent Or Show", type: "string", required: true, source: "derived", derived: "talentOrShowList" },
  { key: "InternationalRace", label: "International Race", type: "boolean", required: true, source: "fixed", fixedValue: false },
  { key: "SportsClass", label: "Sport", type: "enum", required: true, source: "input", control: "select", catalog: "sport", exposed: true },
  { key: "SportsCompetitionName", label: "Competition", type: "enum", required: true, source: "input", control: "select", catalog: "competition", exposed: true },
  { key: "EventDate", label: "Event Date", type: "string", required: true, source: "input", control: "date", exposed: true },
  { key: "IsAvailableOnPlatform", label: "Is Available On Platform", type: "string", required: true, source: "fixed", fixedValue: "No" },
  { key: "ShowPreviewImage", label: "Show Preview Image", type: "boolean", required: true, source: "fixed", fixedValue: true },
  { key: "ThirdPartyFlag", label: "Third Party Flag", type: "boolean", required: true, source: "fixed", fixedValue: true },
  { key: "TipType", label: "Tip Type", type: "enum", required: true, source: "input", control: "select", catalog: "tipType", exposed: true },
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
