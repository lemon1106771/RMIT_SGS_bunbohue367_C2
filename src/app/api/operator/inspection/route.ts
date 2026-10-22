import { withRole } from "@/lib/auth/middleware";
import { readDb } from "@/lib/server/db";
import { ADMIN_ROLE } from "@/lib/cases";

// The fund view needs a small inspection snapshot, not a dump of user identifiers and audit data.
// The candidate policy is used only for the optional Tide decryption refusal demonstration.
export const GET = withRole(ADMIN_ROLE, async () => {
  const db = readDb();
  const firstEntry = db.entries[0] ?? null;
  return Response.json({
    counts: {
      cases: db.cases.length,
      ciphertextItems: db.entries.length,
      signedPolicies: db.policies.length,
      auditEvents: db.audit.length,
    },
    firstCaseId: db.cases[0]?.caseId ?? null,
    firstEntry,
    candidatePolicies: firstEntry ? db.policies.filter((p) => p.recordId === firstEntry.recordId) : [],
  }, { headers: { "Cache-Control": "no-store" } });
});
