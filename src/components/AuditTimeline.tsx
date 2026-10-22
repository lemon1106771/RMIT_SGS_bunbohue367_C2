"use client";
import { useCallback, useEffect, useState } from "react";
import { Ban, ClipboardList, Circle, HandHeart, Lock, LockOpen, RefreshCw, ScrollText, Send, ShieldX, Stamp, User, HandCoins, type LucideIcon } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { ErrorBox } from "@/components/ErrorBox";

interface Row { at: string; actor: string; action: string; recordId: string; detail: string }

const LABEL: Record<string, { icon: LucideIcon; label: string; tone: string }> = {
  "user.registered": { icon: User, label: "Account registered", tone: "" },
  "case.created": { icon: ClipboardList, label: "Case sealed by a volunteer", tone: "" },
  "case.proposed": { icon: Send, label: "Payout proposed by the fund", tone: "" },
  "policy.stored": { icon: ScrollText, label: "Signed access policy stored", tone: "" },
  "entry.added": { icon: Lock, label: "Item encrypted and stored", tone: "" },
  "council.approved": { icon: Stamp, label: "Council member logged an approval", tone: "ok" },
  "decrypt.ok": { icon: LockOpen, label: "Sealed file opened", tone: "ok" },
  "decrypt.refused": { icon: ShieldX, label: "Tide network refused to decrypt", tone: "lock" },
  "bank.payout": { icon: HandCoins, label: "Mock bank paid out", tone: "ok" },
  "bank.denied": { icon: Ban, label: "Bank refused: token lacks the payout group", tone: "lock" },
  "donation.received": { icon: HandHeart, label: "Donation received (mock)", tone: "" },
};

function when(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", { hour12: false, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

/** Vertical audit-log timeline. record omitted = whole log (operator). */
export function AuditTimeline({ record, compact, reloadKey }: { record?: string; compact?: boolean; reloadKey?: number }) {
  const api = useApi();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<unknown>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await api<{ audit: Row[] }>(record ? `/api/audit?record=${encodeURIComponent(record)}` : "/api/audit");
      setRows(r.audit);
    } catch (e) {
      setErr(e);
    }
  }, [api, record]);

  useEffect(() => { load(); }, [load, reloadKey]);

  const list = rows ? [...rows].reverse().slice(0, compact ? 8 : 60) : [];
  return (
    <section className={compact ? "audit audit-compact" : "card audit"} aria-label="Audit trail">
      <div className="card-head">
        <div>
          <h2>Audit trail</h2>
          <p className="card-sub">Append-only. Never holds plaintext.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={15} aria-hidden /> Refresh</button>
      </div>
      <ErrorBox error={err} />
      {!rows && !err ? <div className="skel" role="status" aria-busy="true" aria-label="Loading audit trail"><i /><i /><i /></div> : null}
      {rows && !list.length ? <p className="muted">No events yet. Every seal, proposal and approval will appear here.</p> : null}
      <ol className="timeline">
        {list.map((r, i) => {
          const l = LABEL[r.action] ?? { icon: Circle, label: r.action, tone: "" };
          return (
            <li key={`${r.at}-${i}`} className={l.tone ? `tl-${l.tone}` : undefined}>
              <span className="tl-dot" aria-hidden><l.icon size={14} /></span>
              <div className="tl-body">
                <strong>{l.label}</strong>
                <div className="small muted">{when(r.at)} · {r.actor || "system"}{r.recordId ? ` · ${r.recordId}` : ""}</div>
                {r.detail ? <div className="small tl-detail">{r.detail}</div> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
