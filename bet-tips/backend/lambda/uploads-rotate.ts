import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { UserRole } from "./shared/db";
import { principalFrom, requireAdmin } from "./shared/context";
import { bad, forbidden, ok, parseJson, unauthorized } from "./shared/http";

const lambdaClient = new LambdaClient({});
const RENDER_FN = process.env.RENDER_FN_NAME;

interface RotateBody {
  /** Degrees clockwise to apply on top of what the file already declares. */
  delta: number;
}

interface RotateResult {
  previousRotation: number;
  rotation: number;
  backedUp: boolean;
}

// Quarter turns only. The display matrix can express arbitrary angles, but
// every real correction here is a multiple of 90, and allowing anything else
// would let a typo silently skew a deliverable.
const ALLOWED_DELTAS = new Set([0, 90, 180, 270, -90, -180, -270]);

/**
 * Rewrite the stored upload's display-rotation tag.
 *
 * ffmpeg lives only in the render-worker's container image, so this handler is
 * a thin admin-gated front door that delegates there. The invoke is synchronous
 * because the work is a stream copy (no re-encode) and finishes in seconds —
 * the admin needs the resulting angle back to know it worked.
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

  const uploadId = event.pathParameters?.uploadId;
  if (!uploadId) return bad("uploadId path param required");
  if (!RENDER_FN) return bad("RENDER_FN_NAME not configured");

  let body: RotateBody;
  try {
    body = parseJson<RotateBody>(event.body);
  } catch (e) {
    return bad((e as Error).message);
  }

  if (typeof body.delta !== "number" || !ALLOWED_DELTAS.has(body.delta)) {
    return bad("delta must be one of 0, ±90, ±180, ±270");
  }

  const res = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: RENDER_FN,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(JSON.stringify({ op: "rotate", uploadId, delta: body.delta })),
    })
  );

  const raw = res.Payload ? Buffer.from(res.Payload).toString() : "";
  // A handler that throws still returns 200 at the Lambda API level, with the
  // error in the payload — so FunctionError is the only reliable failure signal.
  if (res.FunctionError) {
    console.error("rotate failed", raw.slice(0, 800));
    return bad(`rotate failed: ${raw.slice(0, 300)}`);
  }

  const result = raw ? (JSON.parse(raw) as RotateResult) : undefined;

  // Re-render from the corrected source. Without this the fix is invisible:
  // the admin plays the rendered output whenever one exists, and that file was
  // baked from the old rotation. Fire-and-forget — the render worker owns
  // renderStatus from here, and it no-ops to `not_required` when there's no EDL.
  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: RENDER_FN,
      InvocationType: "Event",
      Payload: Buffer.from(JSON.stringify({ uploadId })),
    })
  );

  return ok({ ...result, rerenderTriggered: true });
};
