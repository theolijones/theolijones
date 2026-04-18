import type { APIGatewayRequestSimpleAuthorizerHandlerV2 } from "aws-lambda";
import { verifyAccess } from "./shared/jwt";

export const handler: APIGatewayRequestSimpleAuthorizerHandlerV2 = async (event) => {
  const header = event.headers?.authorization ?? event.headers?.Authorization;
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return { isAuthorized: false, context: {} };
  }
  const token = header.slice(7).trim();
  try {
    const claims = await verifyAccess(token);
    return {
      isAuthorized: true,
      context: { userId: claims.sub, role: claims.role },
    };
  } catch {
    return { isAuthorized: false, context: {} };
  }
};
