import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import jwt from "jsonwebtoken";
import type { UserRole } from "./db";

const sm = new SecretsManagerClient({});
let cachedSecret: string | undefined;

const loadSecret = async (): Promise<string> => {
  if (cachedSecret) return cachedSecret;
  const arn = process.env.JWT_SECRET_ARN!;
  const res = await sm.send(new GetSecretValueCommand({ SecretId: arn }));
  if (!res.SecretString) throw new Error("JWT secret missing");
  cachedSecret = res.SecretString;
  return cachedSecret;
};

export interface AccessClaims {
  sub: string;
  role: UserRole;
  kind: "access";
}

export interface RefreshClaims {
  sub: string;
  role: UserRole;
  kind: "refresh";
}

export const signAccess = async (sub: string, role: UserRole): Promise<string> => {
  const secret = await loadSecret();
  return jwt.sign({ sub, role, kind: "access" }, secret, { expiresIn: "1h" });
};

export const signRefresh = async (sub: string, role: UserRole): Promise<string> => {
  const secret = await loadSecret();
  return jwt.sign({ sub, role, kind: "refresh" }, secret, { expiresIn: "365d" });
};

export const verifyAccess = async (token: string): Promise<AccessClaims> => {
  const secret = await loadSecret();
  const decoded = jwt.verify(token, secret) as AccessClaims;
  if (decoded.kind !== "access") throw new Error("Wrong token kind");
  return decoded;
};

export const verifyRefresh = async (token: string): Promise<RefreshClaims> => {
  const secret = await loadSecret();
  const decoded = jwt.verify(token, secret) as RefreshClaims;
  if (decoded.kind !== "refresh") throw new Error("Wrong token kind");
  return decoded;
};
