"use client";
import { explainError } from "@/lib/client/errors";

/** Keep technical error payloads out of the product interface. */
export function ErrorBox({ error, title }: { error: unknown; title?: string }) {
  if (!error) return null;
  const x = explainError(error);
  return (
    <div className={`notice ${x.refused ? "notice-lock" : "notice-err"}`} role="alert">
      <strong>{title ?? (x.refused ? "Refused by the Tide network" : "Something went wrong")}</strong>
      <p>{x.summary}</p>
      {x.refused ? <p className="muted small">This is a rule, not an outage, so the app does not retry.</p> : null}
    </div>
  );
}
