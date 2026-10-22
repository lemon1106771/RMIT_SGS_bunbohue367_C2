// Shared (client + server) naming rules for WholeLeaf.
// One household case = one record id. It is the ONLY tag on every encrypted item (contract rule).

export const BRAND = {
  name: "WholeLeaf",
  sub: "Charity without trusting a hero",
  hero: "Transparency, privacy, control: today you only get two of the three. WholeLeaf gives you all three.",
  payeeDefault: "Hoa Binh Hospital (mock)",
};

export type EntryKind = "identity" | "address" | "damage" | "bank";
export const ENTRY_KINDS: EntryKind[] = ["identity", "address", "damage", "bank"];

export const KIND_LABEL: Record<EntryKind, { label: string; icon: string; hint: string }> = {
  identity: { label: "Name and national ID", icon: "id-card", hint: "Ms. Lan, national ID 04420xxxxxxx" },
  address: { label: "Address", icon: "map-pin", hint: "Hamlet, commune, district" },
  damage: { label: "Circumstances and medical file", icon: "stethoscope", hint: "Daughter, age 5, congenital heart defect, needs surgery…" },
  bank: { label: "Hospital bill reference or account", icon: "banknote", hint: "Hospital bill reference · account number" },
};

export type CaseStatus = "submitted" | "proposed" | "paid";
export const STATUS_LABEL: Record<CaseStatus, { label: string; tone: string }> = {
  submitted: { label: "Sealed", tone: "" },
  proposed: { label: "Payout proposed", tone: "warm" },
  paid: { label: "Paid out", tone: "ok" },
};

export const PROVINCES = ["Quang Binh", "Quang Tri", "Thua Thien Hue", "Da Nang", "Quang Nam", "Quang Ngai", "Binh Dinh", "Ha Tinh"];

/** The 3 council seats, in order. Index in `council[]` = seat. */
export const COUNCIL_ROLES = [
  { title: "Fund lead" },
  { title: "Local Red Cross" },
  { title: "Donor representative" },
];
/** floor(3 x 0.7) = 2 approvals. */
export const QUORUM = 2;

/** case ids become part of a group name, so keep them boring: lowercase letters, digits, dashes. */
export const CASE_ID_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;

/** Record id for a household case. */
export function recordIdFor(caseId: string): string {
  return `case-${caseId}`;
}

/** Case id from a record id, or "" if it is not a case record id. */
export function caseIdOf(recordId: string): string {
  if (!recordId.startsWith("case-")) return "";
  const id = recordId.slice("case-".length);
  return CASE_ID_RE.test(id) ? id : "";
}

/** FULL group path, exactly as the `groups` claim carries it (full.path=true in the realm template). */
export function payoutGroupFor(caseId: string): string {
  return `/payout-case-${caseId}`;
}

/** Group name (no leading slash) to type into the TideCloak admin console. */
export function payoutGroupNameFor(caseId: string): string {
  return `payout-case-${caseId}`;
}

export function fmtVnd(n: number): string {
  try {
    return new Intl.NumberFormat("en-US").format(n) + " VND";
  } catch {
    return `${n} VND`;
  }
}

export const ADMIN_CLIENT = "realm-management";
export const ADMIN_ROLE = "tide-realm-admin";
