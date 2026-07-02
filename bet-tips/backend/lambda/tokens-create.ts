import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomBytes } from "crypto";
import { ddb, tables, type TokenRecord, type UserRole } from "./shared/db";
import { principalFrom, requireAdmin } from "./shared/context";
import { bad, created, forbidden, parseJson, unauthorized } from "./shared/http";

interface CreateBody {
  note?: string;
  expiresAt?: string;
  talentId?: string;
  talentName?: string;
  talentInitials?: string;
}

const generateToken = (): string => {
  const bytes = randomBytes(6);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
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

  let body: CreateBody = {};
  if (event.body) {
    try {
      body = parseJson<CreateBody>(event.body);
    } catch (e) {
      return bad((e as Error).message);
    }
  }

  const talentName = body.talentName?.trim();
  const talentId = body.talentId?.trim();
  const talentInitials = body.talentInitials?.trim().toUpperCase();
  if ((talentId || talentName || talentInitials) && !(talentId && talentName && talentInitials)) {
    return bad("talentId, talentName and talentInitials must be provided together");
  }

  const token = generateToken();
  const now = new Date().toISOString();
  const row: TokenRecord = {
    token,
    status: "active",
    note: body.note,
    issuedBy: p.userId,
    talentId,
    talentName,
    talentInitials,
    createdAt: now,
    expiresAt: body.expiresAt,
  };

  await ddb.send(new PutCommand({ TableName: tables.tokens, Item: row }));
  return created(row);
};
