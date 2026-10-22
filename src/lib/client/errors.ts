// Turn whatever the Tide SDK / network throws into text a human (and a judge watching a video) can read.
// Rule from the contract: a refusal arrives as TIDE-TIDEJS-NET-THRESHOLD_FAILURE and the contract's
// own message sits in error.cause / per-ORK details. Show it, never retry.

export interface ExplainedError {
  summary: string;
  detail: string;
  /** true when the Tide network (the contract) said no, as opposed to a bug or an outage */
  refused: boolean;
}

function lines(e: unknown, depth: number, out: string[], seen: Set<unknown>) {
  if (e === null || e === undefined || depth > 5) return;
  if (typeof e === "string") {
    out.push(e);
    return;
  }
  if (typeof e !== "object") {
    out.push(String(e));
    return;
  }
  if (seen.has(e)) return;
  seen.add(e);
  if (e instanceof Uint8Array) return;
  if (Array.isArray(e)) {
    e.forEach((x) => lines(x, depth + 1, out, seen));
    return;
  }
  const o = e as Record<string, unknown>;
  const pad = "  ".repeat(depth);
  const head: string[] = [];
  if (e instanceof Error) head.push(`${e.name}: ${e.message}`);
  else if (typeof o.message === "string") head.push(o.message);
  for (const k of ["code", "status", "statusCode", "reason", "error", "description"]) {
    const v = o[k];
    if (v !== undefined && v !== null && typeof v !== "object" && String(v) !== (e as Error).message) head.push(`${k}: ${String(v)}`);
  }
  if (head.length) out.push(pad + head.join(" | "));
  for (const k of ["cause", "details", "errors", "responses", "failures", "orks", "data"]) {
    if (o[k] !== undefined && o[k] !== null) {
      if (typeof o[k] === "object") out.push(`${pad}${k}:`);
      lines(o[k], depth + 1, out, seen);
    }
  }
  // any other own props that are strings (some SDK errors carry the ORK message under odd names)
  for (const k of Object.getOwnPropertyNames(o)) {
    if (["stack", "message", "name", "cause", "details", "errors", "responses", "failures", "orks", "data", "code", "status", "statusCode", "reason", "error", "description"].includes(k)) continue;
    const v = o[k];
    if (typeof v === "string" && v.length < 500) out.push(`${pad}${k}: ${v}`);
  }
}

export function explainError(e: unknown): ExplainedError {
  const out: string[] = [];
  lines(e, 0, out, new Set());
  const uniq = out.filter((l, i) => out.indexOf(l) === i);
  const detail = uniq.join("\n").trim() || String(e);
  const refused = /THRESHOLD_FAILURE|Could not reach enough|not found in doken|role not found|subjectId does not match|not found in list of roles/i.test(detail);
  const message = e instanceof Error ? e.message : typeof e === "string" ? e : "An unknown error occurred.";
  const summary = refused
    ? "The Tide network refused this request: the access policy does not allow it."
    : /Failed to construct ['\"]URL|Invalid URL|Failed to fetch|NetworkError/i.test(message)
      ? "Could not contact the app service. Reload and try again."
      : message;
  return { summary, detail, refused };
}
