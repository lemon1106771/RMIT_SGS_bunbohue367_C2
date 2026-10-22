// Derived facts about a case, computed from the append-only audit log. Server only.
// None of this is a security control: the signed policies, the Tide network and the group claim in
// the Tide-signed token are the gate.
import type { CaseRow, Db } from "@/lib/server/db";
import { COUNCIL_ROLES } from "@/lib/cases";

/** The council is the realm's admins (3 of them: IGA quorum floor(3 x 0.7) = 2). Seat = order of first sign-in. */
export function councilOf(db: Db): string[] {
  return db.users
    .filter((u) => u.isAdmin)
    .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))
    .slice(0, COUNCIL_ROLES.length)
    .map((u) => u.username);
}

export interface Approval {
  actor: string;
  /** seat 0..2, or -1 when the person is an admin beyond the first three */
  seat: number;
  at: string;
}

/** Distinct admins who said "I approve this payout" since the current proposal was made. */
export function approvalsOf(db: Db, c: CaseRow): Approval[] {
  if (!c.proposal) return [];
  const council = councilOf(db);
  const seen = new Map<string, Approval>();
  for (const a of db.audit) {
    if (a.action !== "council.approved" || a.recordId !== c.recordId || a.at < c.proposal.proposedAt) continue;
    if (seen.has(a.actor)) continue;
    seen.set(a.actor, { actor: a.actor, seat: council.indexOf(a.actor), at: a.at });
  }
  return Array.from(seen.values()).sort((x, y) => x.at.localeCompare(y.at));
}

export function hasPolicies(db: Db, c: CaseRow) {
  return {
    hasA: db.policies.some((p) => p.recordId === c.recordId && p.subjectType === "User"),
    hasB: db.policies.some((p) => p.recordId === c.recordId && p.subjectType === "Group"),
  };
}

/** For signed-in users: includes usernames of the people involved. No ciphertext, no policies. */
export function caseView(db: Db, c: CaseRow) {
  const receipt = db.ledger.find((l) => l.caseId === c.caseId) ?? null;
  return {
    ...c,
    council: councilOf(db),
    approvals: approvalsOf(db, c),
    ...hasPolicies(db, c),
    itemCount: db.entries.filter((e) => e.recordId === c.recordId).length,
    receipt,
  };
}

/** Label for an audit actor, from the point of view of one case. Never a username. */
export function actorRole(db: Db, c: CaseRow | undefined, actor: string): string {
  if (!actor) return "System";
  const seat = councilOf(db).indexOf(actor);
  if (seat >= 0) return `Council · ${COUNCIL_ROLES[seat]?.title ?? "member"}`;
  if (c && c.proposal && actor === c.proposal.payee) return "Hospital";
  if (c && actor === c.volunteer) return "Volunteer";
  return "Other user";
}
