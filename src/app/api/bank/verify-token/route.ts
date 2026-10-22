import { verifyTideJWT } from "@/lib/auth/tideJWT";
import { groupsOf } from "@/lib/server/claims";

// POST /api/bank/verify-token — NO LOGIN. Body: { token }.
// Runs the template's own signature check (local JWKS, issuer, azp, exp) and nothing else. Used by the
// "forged token" demo: change the payload, keep the old signature, and the check fails. Only the Tide
// network can produce a valid signature, and the signing key is split across it.
// The token is never stored or logged.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let token = "";
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token : "";
  } catch {
    return Response.json({ valid: false, reason: "Invalid JSON" }, { status: 400 });
  }
  if (!token || token.length > 20_000 || token.split(".").length !== 3) {
    return Response.json({ valid: false, reason: "Not a JWT" });
  }
  try {
    const payload = await verifyTideJWT(token);
    return Response.json({ valid: true, groups: groupsOf(payload) });
  } catch (e) {
    return Response.json({ valid: false, reason: e instanceof Error ? e.message : "signature verification failed" });
  }
}
