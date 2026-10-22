import type { CaseStatus } from "@/lib/cases";

export interface EntryDto { id: string; recordId: string; title: string; kind: string; ciphertext: string; createdAt: string }
export interface PolicyDto { subjectType: "User" | "Group" | "Role"; subjectId: string; recordId: string; access: "read" | "write" | "read-write"; policyB64: string; grantedBy: string; createdAt: string }
export interface UserDto { username: string; tideuserkey: string; registeredAt: string; isAdmin?: boolean }

export interface Receipt { caseId: string; recordId: string; amountVnd: number; payee: string; payeeName: string; at: string; txRef: string }

/** Case metadata for signed-in users (GET /api/cases). Plaintext facts only. */
export interface CaseDto {
  caseId: string;
  recordId: string;
  province: string;
  householdSize: number;
  amountVnd: number;
  status: CaseStatus;
  volunteer: string;
  proposal: { amountVnd: number; payee: string; payeeName: string; proposedBy: string; proposedAt: string } | null;
  /** the 3 council usernames in seat order (the realm admins) */
  council: string[];
  createdAt: string;
  updatedAt: string;
  receipt: Receipt | null;
  approvals: { actor: string; seat: number; at: string }[];
  hasA: boolean;
  hasB: boolean;
  itemCount: number;
}

/** "20 Oct 2026" */
export const fmtDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch { return iso; }
};
/** "20 Oct 2026, 15:00" */
export const fmtDateTime = (iso: string) => {
  try { return new Date(iso).toLocaleString("en-GB", { hour12: false, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
};
