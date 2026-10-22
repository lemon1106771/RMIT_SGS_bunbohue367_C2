"use client";
import { explainError } from "./errors";
import type { ApiFn } from "./api";

/** Tell the log what the browser alone saw. Never sends plaintext; a refusal carries the contract message. Never throws. */
export async function reportDecrypt(api: ApiFn, recordId: string, outcome: { ok: true; detail?: string } | { ok: false; error: unknown; detail?: string }) {
  try {
    const detail = outcome.ok
      ? outcome.detail ?? "decrypted in the browser"
      : `${outcome.detail ? outcome.detail + " | " : ""}${explainError(outcome.error).detail}`;
    await api("/api/audit", { method: "POST", body: { action: outcome.ok ? "decrypt.ok" : "decrypt.refused", recordId, detail } });
  } catch {
    /* the log is best-effort from the browser */
  }
}
