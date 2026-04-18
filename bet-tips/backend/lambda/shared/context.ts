import type { APIGatewayProxyEventV2WithLambdaAuthorizer } from "aws-lambda";
import type { UserRole } from "./db";

export interface Principal {
  userId: string;
  role: UserRole;
}

type Event = APIGatewayProxyEventV2WithLambdaAuthorizer<{ userId: string; role: UserRole }>;

export const principalFrom = (event: Event): Principal => {
  const ctx = event.requestContext.authorizer?.lambda as { userId?: string; role?: UserRole } | undefined;
  if (!ctx?.userId || !ctx?.role) throw new Error("Authorizer context missing");
  return { userId: ctx.userId, role: ctx.role };
};

export const requireAdmin = (p: Principal): void => {
  if (p.role !== "admin") {
    const err = new Error("Admin role required");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
};
