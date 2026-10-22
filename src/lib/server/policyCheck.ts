// Server-side sanity check of a signed relationship policy before storing it (README: "parse the
// policy and confirm it names the expected user and record"). This is defence in depth only: the
// ORK network enforces the policy, and the route itself is admin-only from the verified token.
// Deep import: the package index pulls in browser-only clients; the Policy model is plain bytes.
import { Policy } from "@tideorg/js/dist/Models/Policy";

export interface ParsedPolicy {
  contractId: string;
  subjectType: string;
  subjectId: string;
  recordId: string;
  roles: string[];
  signed: boolean;
}

export function parseSignedPolicy(policyB64: string): ParsedPolicy {
  const bytes = Uint8Array.from(Buffer.from(policyB64, "base64"));
  const p = Policy.from(bytes);
  const param = (k: string) => String(p.params.entries.get(k) ?? "");
  let roles: string[] = [];
  try {
    const r = JSON.parse(param("roles"));
    if (Array.isArray(r)) roles = r.map(String);
  } catch {
    roles = [];
  }
  return {
    contractId: p.contractId,
    subjectType: param("subjectType"),
    subjectId: param("subjectId"),
    recordId: param("assignmentId"),
    roles,
    signed: !!p.signature && p.signature.length > 0,
  };
}
