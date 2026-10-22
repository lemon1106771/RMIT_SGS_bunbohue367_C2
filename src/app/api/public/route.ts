import { readDb } from "@/lib/server/db";
import { actorRole, approvalsOf, councilOf } from "@/lib/server/caseState";
import { COUNCIL_ROLES } from "@/lib/cases";

// GET /api/public — NO LOGIN. The donor-facing view. It is built field by field from an allow-list:
// case metadata (province, household size, amount, status), the proposed payee's DISPLAY name (a
// hospital), who approved by ROLE (never a username), the bank ledger (txRef, amount, time) and audit
// events by role label + time. It never returns ciphertext, entry titles, policies, usernames,
// free-text audit details or any item. That is the whole point: "0 personal data public".
export const dynamic = "force-dynamic";

const PUBLIC_ACTIONS = new Set([
  "case.created",
  "case.proposed",
  "policy.stored",
  "entry.added",
  "council.approved",
  "decrypt.ok",
  "decrypt.refused",
  "bank.payout",
  "bank.denied",
]);

export async function GET() {
  const db = readDb();
  const byRecord = new Map(db.cases.map((c) => [c.recordId, c]));
  const council = councilOf(db);

  const donatedBy = new Map<string, number>();
  for (const d of db.donations) donatedBy.set(d.caseId, (donatedBy.get(d.caseId) ?? 0) + d.amountVnd);

  const cases = db.cases.map((c) => {
    const receipt = db.ledger.find((l) => l.caseId === c.caseId);
    return {
      caseId: c.caseId,
      province: c.province,
      householdSize: c.householdSize,
      amountVnd: c.amountVnd,
      status: c.status,
      proposal: c.proposal ? { amountVnd: c.proposal.amountVnd, payeeName: c.proposal.payeeName, at: c.proposal.proposedAt } : null,
      approvals: approvalsOf(db, c).map((a) => ({ role: COUNCIL_ROLES[a.seat]?.title ?? "Council", seat: a.seat, at: a.at })),
      sealedItems: db.entries.filter((e) => e.recordId === c.recordId).length,
      donatedVnd: donatedBy.get(c.caseId) ?? 0,
      paidAt: receipt?.at ?? null,
      txRef: receipt?.txRef ?? null,
      createdAt: c.createdAt,
    };
  });

  const ledger = db.ledger
    .map((l) => ({ caseId: l.caseId, payeeName: l.payeeName, amountVnd: l.amountVnd, at: l.at, txRef: l.txRef, approvedBy: "2 of 3 council" }))
    .reverse();

  const events = db.audit
    .filter((a) => PUBLIC_ACTIONS.has(a.action) && byRecord.has(a.recordId))
    .map((a) => {
      const c = byRecord.get(a.recordId)!;
      const adminAction = a.action === "policy.stored" || a.action === "case.proposed";
      return {
        at: a.at,
        caseId: c.caseId,
        action: a.action,
        actorRole: adminAction ? "Council" : a.action === "bank.payout" ? "Bank (mock)" : actorRole(db, c, a.actor),
      };
    })
    .reverse()
    .slice(0, 80);

  const donations = db.donations
    .slice(-30)
    .reverse()
    .map((d) => ({ name: d.name, amountVnd: d.amountVnd, at: d.at, caseId: d.caseId }));

  const sum = (n: number[]) => n.reduce((x, y) => x + y, 0);
  const totals = {
    cases: cases.length,
    people: sum(cases.map((c) => c.householdSize)),
    requestedVnd: sum(cases.map((c) => c.amountVnd)),
    proposedVnd: sum(cases.filter((c) => c.proposal).map((c) => c.proposal!.amountVnd)),
    paidVnd: sum(db.ledger.map((l) => l.amountVnd)),
    paidCases: db.ledger.length,
    donatedVnd: sum(db.donations.map((d) => d.amountVnd)),
    donationCount: db.donations.length,
    councilSize: council.length,
    personalDataPublished: 0,
  };

  return Response.json({ cases, ledger, events, donations, totals }, { headers: { "Cache-Control": "no-store" } });
}
