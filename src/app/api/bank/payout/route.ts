import { randomBytes } from "crypto";
import { withAuth } from "@/lib/auth/middleware";
import { updateDb, pushAudit, type LedgerRow } from "@/lib/server/db";
import { groupsOf, usernameOf } from "@/lib/server/claims";
import { CASE_ID_RE, payoutGroupFor } from "@/lib/cases";

// POST /api/bank/payout — the MOCK BANK. Body: { caseId }.
//
// It trusts exactly one thing: the access token. withAuth has already verified the Tide signature
// (local JWKS), issuer, azp, expiry and the DPoP binding. The only question left is: does the
// verified `groups` claim contain /payout-case-<caseId>? Tide puts that claim in only after 2 of 3
// realm admins approved adding the caller to the group (IGA change request). The request body, the
// username and every other header are ignored for authorisation.
//
// No money moves. A successful call appends a ledger row, marks the case paid and logs an audit event.
// Idempotent: a second authorised call returns the existing ledger row.
const DENIED = {
  error: "not_authorised",
  message: "Refused: your sign-in token does not carry this case's payout group. A payout needs 2 of 3 council approvals in TideCloak.",
};

export const POST = withAuth(async (req, jwt) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const caseId = body.caseId;
  if (typeof caseId !== "string" || !CASE_ID_RE.test(caseId)) {
    return Response.json({ error: "Invalid caseId" }, { status: 400 });
  }
  const caller = usernameOf(jwt);
  const recordId = `case-${caseId}`;

  if (!groupsOf(jwt).includes(payoutGroupFor(caseId))) {
    updateDb((db) => pushAudit(db, caller, "bank.denied", recordId, "token does not carry the payout group"));
    return Response.json(DENIED, { status: 403 });
  }

  const result = updateDb((db) => {
    const existing = db.ledger.find((l) => l.caseId === caseId);
    if (existing) return { row: existing, replay: true };
    const c = db.cases.find((x) => x.caseId === caseId);
    if (!c) return { error: "Case not found", status: 404 };
    if (!c.proposal) return { error: "no_proposal", message: "The fund has not proposed a payout for this case yet.", status: 409 };
    const now = new Date().toISOString();
    const row: LedgerRow = {
      caseId,
      recordId,
      amountVnd: c.proposal.amountVnd,
      payee: caller,
      payeeName: c.proposal.payeeName,
      at: now,
      txRef: `MOCK-${randomBytes(5).toString("hex").toUpperCase()}`,
    };
    db.ledger.push(row);
    c.status = "paid";
    c.updatedAt = now;
    pushAudit(db, caller, "bank.payout", recordId, `${row.txRef} · ${row.amountVnd} VND (mock)`);
    return { row, replay: false };
  });
  if ("error" in result) {
    return Response.json({ error: result.error, message: "message" in result ? result.message : undefined }, { status: result.status });
  }
  return Response.json({ receipt: result.row, replay: result.replay }, { status: result.replay ? 200 : 201 });
});
