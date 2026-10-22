import { randomUUID } from "crypto";
import { readDb, updateDb, pushAudit, type DonationRow } from "@/lib/server/db";
import { CASE_ID_RE } from "@/lib/cases";

// POST /api/donations — NO LOGIN. A MOCK donation (no real money). Body: { amount, name?, caseId? }.
// The display name is free text that goes on the public page, so it is short and the UI tells donors not
// to put personal data there. caseId "" = the fund in general.
export const dynamic = "force-dynamic";
const MAX_ROWS = 2000;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { amount, name, caseId } = body;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1000 || amount > 1_000_000_000) {
    return Response.json({ error: "The amount must be between 1,000 and 1,000,000,000 VND." }, { status: 400 });
  }
  const display = typeof name === "string" && name.trim() ? name.trim().replace(/\s+/g, " ").slice(0, 40) : "Anonymous";
  const target = typeof caseId === "string" ? caseId : "";
  if (target && !CASE_ID_RE.test(target)) return Response.json({ error: "Invalid caseId" }, { status: 400 });

  const result = updateDb((db) => {
    if (target && !db.cases.some((c) => c.caseId === target)) return { error: "Case not found", status: 404 };
    if (db.donations.length >= MAX_ROWS) return { error: "Demo limit reached", status: 429 };
    const row: DonationRow = { id: randomUUID(), caseId: target, amountVnd: amount, name: display, at: new Date().toISOString() };
    db.donations.push(row);
    pushAudit(db, "", "donation.received", target ? `case-${target}` : "", `${amount} VND (mock)`);
    return { donation: row };
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result, { status: 201 });
}

export async function GET() {
  const { donations } = readDb();
  return Response.json({ donations: donations.slice(-50).reverse() });
}
