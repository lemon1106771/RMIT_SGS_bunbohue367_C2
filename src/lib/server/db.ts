// Tiny JSON-file database for the hackathon prototype: data/clearaid-db.json (gitignored).
// It only ever holds ciphertext, signed policies and public identifiers. Never plaintext.
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from "fs";
import { join } from "path";

export interface UserRow {
  username: string;
  tideuserkey: string;
  sub: string;
  registeredAt: string;
  /** tide-realm-admin at last sign-in (from the verified token). Used only to suggest council members in the UI. */
  isAdmin?: boolean;
}

export interface EntryRow {
  id: string;
  recordId: string;
  title: string;
  kind: string;
  ciphertext: string;
  createdAt: string;
}

export interface PolicyRow {
  subjectType: "User" | "Group" | "Role";
  subjectId: string;
  recordId: string;
  access: "read" | "write" | "read-write";
  policyB64: string;
  grantedBy: string;
  createdAt: string;
}

/** Append-only log. Never holds plaintext; refusals carry the contract message. */
export interface AuditRow {
  at: string;
  actor: string;
  action: string;
  recordId: string;
  detail: string;
}

/** The fund lead's proposal: pay this amount DIRECTLY to this payee (a hospital account). */
export interface Proposal {
  amountVnd: number;
  /** TideCloak username of the hospital account that will be added to /payout-case-<id> */
  payee: string;
  /** display name, safe to show publicly, e.g. "Hoa Binh Hospital (mock)" */
  payeeName: string;
  proposedBy: string;
  proposedAt: string;
}

/** Household case. Plaintext metadata only (safe to show publicly). NOT a security control. */
export interface CaseRow {
  caseId: string;
  recordId: string;
  province: string;
  householdSize: number;
  amountVnd: number;
  status: "submitted" | "proposed" | "paid";
  volunteer: string;
  proposal: Proposal | null;
  createdAt: string;
  updatedAt: string;
}

/** The mock bank's ledger. One row per paid case. Written only by /api/bank/payout. */
export interface LedgerRow {
  caseId: string;
  recordId: string;
  amountVnd: number;
  /** username of the caller whose token carried the payout group */
  payee: string;
  payeeName: string;
  at: string;
  txRef: string;
}

/** Mock donation (no real money). */
export interface DonationRow {
  id: string;
  caseId: string;
  amountVnd: number;
  name: string;
  at: string;
}

export interface Db {
  users: UserRow[];
  entries: EntryRow[];
  policies: PolicyRow[];
  audit: AuditRow[];
  cases: CaseRow[];
  ledger: LedgerRow[];
  donations: DonationRow[];
}

/** Call inside updateDb(). Append-only: there is no update or delete for audit rows. */
export function pushAudit(db: Db, actor: string, action: string, recordId: string, detail = "") {
  db.audit.push({ at: new Date().toISOString(), actor, action, recordId, detail: detail.slice(0, 1500) });
}

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "clearaid-db.json");

export function readDb(): Db {
  try {
    if (!existsSync(DB_PATH)) return { users: [], entries: [], policies: [], audit: [], cases: [], ledger: [], donations: [] };
    const raw = JSON.parse(readFileSync(DB_PATH, "utf-8"));
    return {
      users: Array.isArray(raw.users) ? raw.users : [],
      entries: Array.isArray(raw.entries) ? raw.entries : [],
      policies: Array.isArray(raw.policies) ? raw.policies : [],
      audit: Array.isArray(raw.audit) ? raw.audit : [],
      cases: Array.isArray(raw.cases) ? raw.cases : [],
      ledger: Array.isArray(raw.ledger) ? raw.ledger : [],
      donations: Array.isArray(raw.donations) ? raw.donations : [],
    };
  } catch {
    return { users: [], entries: [], policies: [], audit: [], cases: [], ledger: [], donations: [] };
  }
}

/** Read-modify-write. Single process (next dev) only; good enough for a demo. */
export function updateDb<T>(fn: (db: Db) => T): T {
  const db = readDb();
  const result = fn(db);
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, DB_PATH);
  return result;
}
