import { withRole } from "@/lib/auth/middleware";
import { updateDb, pushAudit } from "@/lib/server/db";
import { caseView } from "@/lib/server/caseState";
import { isRealmAdmin, usernameOf } from "@/lib/server/claims";
import { ADMIN_ROLE, BRAND, CASE_ID_RE } from "@/lib/cases";

// POST /api/cases/:id/propose — the fund lead (a realm admin, checked from the verified token)
// proposes paying an amount DIRECTLY to a payee (a hospital account). Body: { amount, payee, payeeName? }
// This only records the proposal. Nothing is paid, and nothing is unlocked: the bank pays out only when
// the payee's Tide-signed token carries the case's payout group, i.e. after 2 of 3 admins approved the
// group change in TideCloak.
// (The id is read from the URL: the template's withAuth does not pass route params.)
export const POST = withRole(ADMIN_ROLE, async (req, jwt) => {
  if (!isRealmAdmin(jwt)) return Response.json({ error: "Forbidden: tide-realm-admin required" }, { status: 403 });
  const parts = new URL(req.url).pathname.split("/").filter(Boolean); // api, cases, <id>, propose
  const caseId = decodeURIComponent(parts[parts.length - 2] ?? "");
  if (!CASE_ID_RE.test(caseId)) return Response.json({ error: "Invalid case id" }, { status: 400 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { amount, payee, payeeName } = body;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1000 || amount > 10_000_000_000) {
    return Response.json({ error: "amount must be a whole number of VND" }, { status: 400 });
  }
  if (typeof payee !== "string" || !/^[A-Za-z0-9._@-]{1,100}$/.test(payee.trim())) {
    return Response.json({ error: "payee must be the hospital account's username" }, { status: 400 });
  }
  const name = typeof payeeName === "string" && payeeName.trim() ? payeeName.trim().slice(0, 80) : BRAND.payeeDefault;
  const actor = usernameOf(jwt);

  const result = updateDb((db) => {
    const c = db.cases.find((x) => x.caseId === caseId);
    if (!c) return { error: "Case not found", status: 404 };
    if (c.status === "paid") return { error: "Case is already paid", status: 409 };
    const now = new Date().toISOString();
    c.proposal = { amountVnd: amount, payee: payee.trim(), payeeName: name, proposedBy: actor, proposedAt: now };
    c.status = "proposed";
    c.updatedAt = now;
    pushAudit(db, actor, "case.proposed", c.recordId, `${amount} VND -> ${name}`);
    return { case: caseView(db, c) };
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result, { status: 201 });
});
