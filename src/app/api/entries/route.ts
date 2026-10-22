import { randomUUID } from "crypto";
import { withAuth } from "@/lib/auth/middleware";
import { readDb, updateDb, pushAudit, type EntryRow } from "@/lib/server/db";
import { usernameOf } from "@/lib/server/claims";
import { ENTRY_KINDS, caseIdOf, type EntryKind } from "@/lib/cases";

// GET /api/entries[?record=case-x] — any signed-in user. Titles are plaintext metadata by design
// (the UI only ever sends the kind label, never anything personal); the household's data is
// ciphertext that only the Tide network can open, under the record's policies.
export const GET = withAuth(async (req) => {
  const record = new URL(req.url).searchParams.get("record");
  const { entries } = readDb();
  const list = record ? entries.filter((e) => e.recordId === record) : entries;
  return Response.json({ entries: list });
});

// POST /api/entries — only the case's field volunteer writes (from the verified token).
// Body: { recordId, title, kind, ciphertext }. The server never receives plaintext.
export const POST = withAuth(async (req, jwt) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const username = usernameOf(jwt);
  if (!username) return Response.json({ error: "Token has no preferred_username" }, { status: 400 });
  const { recordId, title, kind, ciphertext } = body;
  if (typeof recordId !== "string" || !caseIdOf(recordId)) {
    return Response.json({ error: "recordId must be case-<caseId>" }, { status: 400 });
  }
  if (typeof title !== "string" || !title.trim() || title.length > 200) {
    return Response.json({ error: "Invalid title" }, { status: 400 });
  }
  if (typeof kind !== "string" || !ENTRY_KINDS.includes(kind as EntryKind)) {
    return Response.json({ error: "Invalid kind" }, { status: 400 });
  }
  if (typeof ciphertext !== "string" || !ciphertext || ciphertext.length > 200_000) {
    return Response.json({ error: "Missing ciphertext" }, { status: 400 });
  }
  const entry: EntryRow = {
    id: randomUUID(),
    recordId,
    title: title.trim(),
    kind,
    ciphertext,
    createdAt: new Date().toISOString(),
  };
  const result = updateDb((db) => {
    const c = db.cases.find((x) => x.recordId === recordId);
    if (!c) return { error: "Case not found", status: 404 };
    if (c.volunteer !== username) return { error: `Only the case's field volunteer (${c.volunteer}) may add items.`, status: 403 };
    db.entries.push(entry);
    pushAudit(db, username, "entry.added", recordId, kind);
    return { ok: true };
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ entry }, { status: 201 });
});
