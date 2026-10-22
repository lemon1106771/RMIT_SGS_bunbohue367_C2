import { withAuth } from "@/lib/auth/middleware";
import { readDb } from "@/lib/server/db";

// GET /api/policies/all — read-only metadata (no policy bytes) for the council/operator pages.
export const GET = withAuth(async () => {
  const policies = readDb().policies.map(({ policyB64: _omit, ...meta }) => meta);
  return Response.json({ policies });
});
