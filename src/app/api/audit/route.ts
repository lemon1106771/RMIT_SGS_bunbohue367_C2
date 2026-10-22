import { withAuth } from "@/lib/auth/middleware";
import { readDb, updateDb, pushAudit } from "@/lib/server/db";
import { approvalsOf } from "@/lib/server/caseState";
import { isRealmAdmin, usernameOf } from "@/lib/server/claims";
import { caseIdOf } from "@/lib/cases";

// GET /api/audit[?record=case-x] — the append-only log, newest last. Never holds plaintext.
export const GET = withAuth(async (req) => {
  const record = new URL(req.url).searchParams.get("record");
  const { audit } = readDb();
  return Response.json({ audit: record ? audit.filter((a) => a.recordId === record) : audit });
});

// POST /api/audit — the browser reports outcomes only it can see (the Tide network answered yes/no),
// plus one statement by people (a council member saying "I approve"). The actor always comes from the verified token.
// Body: { action, recordId, detail }. This is a record of what the client says happened,
// NOT a security control: the real gates are the signed policies and the TideCloak change request.
const CLIENT_ACTIONS = ["decrypt.ok", "decrypt.refused", "council.approved"];

export const POST = withAuth(async (req, jwt) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const actor = usernameOf(jwt);
  const { action, recordId, detail } = body;
  if (typeof action !== "string" || !CLIENT_ACTIONS.includes(action)) {
    return Response.json({ error: `action must be one of ${CLIENT_ACTIONS.join(", ")}` }, { status: 400 });
  }
  if (typeof recordId !== "string" || !caseIdOf(recordId)) {
    return Response.json({ error: "recordId must be case-<caseId>" }, { status: 400 });
  }
  const text = typeof detail === "string" ? detail : "";

  const result = updateDb((db) => {
    const c = db.cases.find((x) => x.recordId === recordId);
    if (!c) return { error: "Case not found", status: 404 };

    if (action === "council.approved") {
      if (!isRealmAdmin(jwt)) return { error: "Only council members (tide-realm-admin) may record an approval", status: 403 };
      if (!c.proposal) return { error: "There is no payout proposal to approve yet", status: 409 };
      if (c.status === "paid") return { error: "Case is already paid", status: 409 };
      if (approvalsOf(db, c).some((a) => a.actor === actor)) return { error: "You already recorded your approval", status: 409 };
    }

    pushAudit(db, actor, action, recordId, text);
    return { ok: true };
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true }, { status: 201 });
});
