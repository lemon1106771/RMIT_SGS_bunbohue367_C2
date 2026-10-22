import { withAuth } from "@/lib/auth/middleware";
import { readDb, updateDb, pushAudit, type CaseRow } from "@/lib/server/db";
import { caseView } from "@/lib/server/caseState";
import { usernameOf } from "@/lib/server/claims";
import { CASE_ID_RE, recordIdFor } from "@/lib/cases";

// GET /api/cases[?case=id] — case metadata (plaintext by design: province, size, amount, status)
// plus who approved. Display aid only. The real gate is the signed policies and the Tide network.
export const GET = withAuth(async (req) => {
  const id = new URL(req.url).searchParams.get("case");
  const db = readDb();
  const list = id ? db.cases.filter((c) => c.caseId === id) : db.cases;
  return Response.json({ cases: list.map((c) => caseView(db, c)) });
});

// POST /api/cases — any signed-in user (a field volunteer) opens a case. The volunteer is the
// caller, taken from the verified token. Body: { caseId, province, householdSize, amountVnd }
export const POST = withAuth(async (req, jwt) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const volunteer = usernameOf(jwt);
  if (!volunteer) return Response.json({ error: "Token has no preferred_username" }, { status: 400 });
  const { caseId, province, householdSize, amountVnd } = body;
  if (typeof caseId !== "string" || !CASE_ID_RE.test(caseId)) {
    return Response.json({ error: "The case id must be 2-31 characters: lowercase letters, digits and hyphens." }, { status: 400 });
  }
  if (typeof province !== "string" || !province.trim() || province.length > 60) {
    return Response.json({ error: "Invalid province" }, { status: 400 });
  }
  if (typeof householdSize !== "number" || !Number.isInteger(householdSize) || householdSize < 1 || householdSize > 50) {
    return Response.json({ error: "householdSize must be 1 to 50" }, { status: 400 });
  }
  if (typeof amountVnd !== "number" || !Number.isInteger(amountVnd) || amountVnd < 1000 || amountVnd > 10_000_000_000) {
    return Response.json({ error: "amountVnd must be a whole number of VND" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const row: CaseRow = {
    caseId,
    recordId: recordIdFor(caseId),
    province: province.trim(),
    householdSize,
    amountVnd,
    status: "submitted",
    volunteer,
    proposal: null,
    createdAt: now,
    updatedAt: now,
  };
  const created = updateDb((db) => {
    if (db.cases.some((c) => c.caseId === caseId)) return false;
    db.cases.push(row);
    pushAudit(db, volunteer, "case.created", row.recordId, `${row.province}; ${row.householdSize} people; ${row.amountVnd} VND`);
    return true;
  });
  if (!created) return Response.json({ error: `Case '${caseId}' already exists. Choose a different case id.` }, { status: 409 });
  return Response.json({ case: row }, { status: 201 });
});
