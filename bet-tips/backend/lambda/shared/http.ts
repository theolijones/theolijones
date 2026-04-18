import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

const JSON_HEADERS = { "content-type": "application/json" };

export const ok = (body: unknown): APIGatewayProxyStructuredResultV2 => ({
  statusCode: 200,
  headers: JSON_HEADERS,
  body: JSON.stringify(body),
});

export const created = (body: unknown): APIGatewayProxyStructuredResultV2 => ({
  statusCode: 201,
  headers: JSON_HEADERS,
  body: JSON.stringify(body),
});

export const noContent = (): APIGatewayProxyStructuredResultV2 => ({ statusCode: 204 });

export const bad = (message: string, code = 400): APIGatewayProxyStructuredResultV2 => ({
  statusCode: code,
  headers: JSON_HEADERS,
  body: JSON.stringify({ error: message }),
});

export const unauthorized = (message = "Unauthorized") => bad(message, 401);
export const forbidden = (message = "Forbidden") => bad(message, 403);
export const notFound = (message = "Not found") => bad(message, 404);
export const conflict = (message = "Conflict") => bad(message, 409);
export const serverError = (message = "Internal error") => bad(message, 500);

export const parseJson = <T = unknown>(raw: string | undefined | null): T => {
  if (!raw) throw new Error("Body required");
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
};
