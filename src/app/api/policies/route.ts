import { withRole, withAuth } from "@/lib/auth/middleware";
import { readDb, updateDb, pushAudit, type PolicyRow } from "@/lib/server/db";
import { groupsOf, isRealmAdmin, tideUserKeyOf, usernameOf } from "@/lib/server/claims";
import { parseSignedPolicy } from "@/lib/server/policyCheck";
import { ADMIN_ROLE, caseIdOf, payoutGroupFor } from "@/lib/cases";

const ROLES_FOR: Record<PolicyRow["access"], string[]> = {
  read: ["_tide_decryptor"],
  write: ["_tide_encryptor"],
  "read-write": ["_tide_encryptor", "_tide_decryptor"],
};

// POST /api/policies — realm admins (council) only, checked from the verified token.
// Body: { subject: { type, id }, recordId, access, policy }  (policy = signed policy, base64)
export const POST = withRole(ADMIN_ROLE, async (req, jwt) => {
  if (!isRealmAdmin(jwt)) {
    return Response.json({ error: "Forbidden: tide-realm-admin (realm-management) required" }, { status: 403 });
  }
  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { subject, recordId, access, policy } = body;
  if (!subject || (subject.type !== "User" && subject.type !== "Group") || typeof subject.id !== "string" || !subject.id) {
    return Response.json({ error: "subject must be { type: 'User'|'Group', id }" }, { status: 400 });
  }
  const caseId = typeof recordId === "string" ? caseIdOf(recordId) : "";
  if (!caseId) {
    return Response.json({ error: "recordId must be case-<caseId>" }, { status: 400 });
  }
  if (!["read", "write", "read-write"].includes(access)) {
    return Response.json({ error: "Invalid access" }, { status: 400 });
  }
  if (typeof policy !== "string" || !policy) {
    return Response.json({ error: "Missing policy" }, { status: 400 });
  }

  // App rules for this product: Policy A = the case's field volunteer (User, read-write);
  // Policy B = the case's payout group (Group, read only). The group starts empty.
  const db = readDb();
  const c = db.cases.find((x) => x.caseId === caseId);
  if (!c) return Response.json({ error: `Case '${caseId}' does not exist` }, { status: 404 });
  if (subject.type === "User") {
    const volunteerRow = db.users.find((u) => u.username === c.volunteer);
    if (!volunteerRow) return Response.json({ error: `Volunteer '${c.volunteer}' has not signed in yet` }, { status: 400 });
    if (volunteerRow.tideuserkey !== subject.id) {
      return Response.json({ error: "User policy must name the case volunteer's tideuserkey" }, { status: 400 });
    }
    if (access !== "read-write") return Response.json({ error: "Volunteer policy must be read-write" }, { status: 400 });
  } else {
    if (subject.id !== payoutGroupFor(caseId)) {
      return Response.json({ error: `Group policy must name ${payoutGroupFor(caseId)}` }, { status: 400 });
    }
    if (access !== "read") return Response.json({ error: "Payout policy must be read-only" }, { status: 400 });
  }

  // Parse the signed bytes and confirm they say what the request claims.
  let parsed;
  try {
    parsed = parseSignedPolicy(policy);
  } catch (e) {
    return Response.json({ error: `Could not parse policy: ${e instanceof Error ? e.message : String(e)}` }, { status: 400 });
  }
  const expectedRoles = ROLES_FOR[access as PolicyRow["access"]];
  if (
    parsed.contractId !== "RelationshipAttestation:1" ||
    parsed.subjectType.toLowerCase() !== subject.type.toLowerCase() ||
    parsed.subjectId !== subject.id ||
    parsed.recordId !== recordId ||
    parsed.roles.length !== expectedRoles.length ||
    !expectedRoles.every((r) => parsed.roles.includes(r)) ||
    !parsed.signed
  ) {
    return Response.json({ error: "Signed policy does not match the requested subject/record/access", parsed }, { status: 400 });
  }

  const row: PolicyRow = {
    subjectType: subject.type,
    subjectId: subject.id,
    recordId,
    access,
    policyB64: policy,
    grantedBy: usernameOf(jwt),
    createdAt: new Date().toISOString(),
  };
  updateDb((d) => {
    // unique on (subjectType, subjectId, recordId)
    d.policies = d.policies.filter(
      (p) => !(p.subjectType === row.subjectType && p.subjectId === row.subjectId && p.recordId === row.recordId)
    );
    d.policies.push(row);
    pushAudit(d, row.grantedBy, "policy.stored", recordId, `${subject.type} ${subject.id} (${access})`);
  });
  return Response.json({ ok: true, policy: { ...row, policyB64: undefined } }, { status: 201 });
});

// GET /api/policies?record=case-x — only the policies that apply to the caller: the User policy
// naming their tideuserkey, or a Group policy whose path is in their verified `groups` claim.
// One addition: the hospital account named in the case's payout proposal also gets that case's payout-group policy BEFORE the
// token lists the group, so the Tide network (not this server) is the one that says "not yet".
// The signed policy is not a secret; the ORKs enforce who may use it.
export const GET = withAuth(async (req, jwt) => {
  const record = new URL(req.url).searchParams.get("record");
  if (!record) return Response.json({ error: "Missing record" }, { status: 400 });
  const key = tideUserKeyOf(jwt);
  const groups = groupsOf(jwt);
  const me = usernameOf(jwt);
  const db = readDb();
  const c = db.cases.find((x) => x.recordId === record);
  const isPayee = !!c && !!me && c.proposal?.payee === me;
  const mine = db.policies.filter(
    (p) =>
      p.recordId === record &&
      ((p.subjectType === "User" && !!key && p.subjectId === key) ||
        (p.subjectType === "Group" && (groups.includes(p.subjectId) || (isPayee && !!c && p.subjectId === payoutGroupFor(c.caseId)))))
  );
  return Response.json({ policies: mine });
});
