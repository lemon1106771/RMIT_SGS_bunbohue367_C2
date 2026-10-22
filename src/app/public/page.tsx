"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, BookOpenCheck, CircleCheck, ClipboardList, Circle, HandCoins, HandHeart, Lock, LockOpen, RefreshCw, ScrollText, Send, ShieldX, Stamp, TriangleAlert, LoaderCircle, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Seal, SealSlot } from "@/components/Seal";
import { StatusChip } from "@/components/StatusChip";
import { ErrorBox } from "@/components/ErrorBox";
import { COUNCIL_ROLES, QUORUM, fmtVnd, type CaseStatus } from "@/lib/cases";
import { fmtDateTime } from "@/lib/client/types";

// Public page: NO login, plain fetch. It only ever shows what GET /api/public allow-lists.

interface PubApproval { role: string; seat?: number; at: string }
interface PubCase {
  caseId: string;
  province: string;
  householdSize: number;
  amountVnd: number;
  status: CaseStatus;
  proposal: { amountVnd: number; payeeName: string; at: string } | null;
  approvals: PubApproval[];
  sealedItems: number;
  donatedVnd: number;
  paidAt: string | null;
  txRef: string | null;
}
interface PubLedger { caseId: string; payeeName: string; amountVnd: number; at: string; txRef: string; approvedBy: string }
interface PubEvent { at: string; caseId: string; action: string; actorRole: string }
interface PubDonation { name: string; amountVnd: number; at: string; caseId: string }
interface PubData {
  cases: PubCase[];
  ledger: PubLedger[];
  events: PubEvent[];
  donations: PubDonation[];
  totals: { cases: number; people: number; requestedVnd: number; proposedVnd: number; paidVnd: number; paidCases: number; donatedVnd: number; donationCount: number; councilSize: number; personalDataPublished: number };
}

const EVENT: Record<string, { Icon: LucideIcon; text: string }> = {
  "case.created": { Icon: ClipboardList, text: "A volunteer sealed a case file" },
  "case.proposed": { Icon: Send, text: "The fund proposed a payout" },
  "policy.stored": { Icon: ScrollText, text: "The council signed the access rule" },
  "entry.added": { Icon: Lock, text: "An item was encrypted" },
  "council.approved": { Icon: Stamp, text: "A council member logged an approval" },
  "decrypt.ok": { Icon: LockOpen, text: "The hospital opened the sealed file" },
  "decrypt.refused": { Icon: ShieldX, text: "The Tide network refused to open the file" },
  "bank.payout": { Icon: HandCoins, text: "The mock bank paid out" },
  "bank.denied": { Icon: Ban, text: "The mock bank refused: token lacks the payout group" },
};

/** A solid ink bar standing in for a field that never leaves the sealed file. */
function Redacted({ size = "m" }: { size?: "s" | "m" | "l" }) {
  return <span className={`redact redact-${size}`} role="img" aria-label="hidden to protect the recipient" />;
}

/** One seal per approval, placed by council seat (never by role label). Public data carries roles, never names. */
function PublicSeals({ approvals, size = 44 }: { approvals: PubApproval[]; size?: number }) {
  const total = COUNCIL_ROLES.length;
  const bySeat: (PubApproval | undefined)[] = Array.from({ length: total }, () => undefined);
  const spare: PubApproval[] = [];
  for (const a of approvals) {
    if (Number.isInteger(a.seat) && (a.seat as number) >= 0 && (a.seat as number) < total && !bySeat[a.seat as number]) bySeat[a.seat as number] = a;
    else spare.push(a);
  }
  for (const a of spare) {
    const free = bySeat.findIndex((x) => !x);
    if (free >= 0) bySeat[free] = a;
  }
  const open = approvals.length >= QUORUM;
  return (
    <div className="cell">
      <div className="minis" role="group" aria-label={`${approvals.length} of ${total} council seals`}>
        {bySeat.map((a, i) => (a ? <Seal key={i} mark={String(i + 1)} label={a.role} size={size} rot={[-7, 5, -3][i % 3]} /> : <SealSlot key={i} size={size} />))}
      </div>
      <span className="small muted">{open ? <><LockOpen size={13} aria-hidden style={{ verticalAlign: "-2px" }} /> {approvals.length} of {total}: unlocked</> : <><Lock size={13} aria-hidden style={{ verticalAlign: "-2px" }} /> {approvals.length} of {total}: locked</>}</span>
    </div>
  );
}

const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);

export default function PublicPage() {
  const [data, setData] = useState<PubData | null>(null);
  const [err, setErr] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/public", { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setData((await res.json()) as PubData);
      setErr(null);
    } catch (e) {
      setErr(e);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const t = data?.totals;
  const loading = !data && !err;

  return (
    <>
      <PageHeader title="Public ledger" purpose="See where the money goes and who approved it. No sign-in needed, and no recipient is ever named." />

      <ErrorBox error={err} title="Could not load the statement" />

      <section className="statement" aria-labelledby="stmt-h">
        <div className="statement-head">
          <h2 id="stmt-h">Fund statement</h2>
          <span className="when">Updates every 15 seconds · mock bank</span>
        </div>

        {loading ? (
          <div className="statement-sec" role="status" aria-busy="true"><div className="skel"><i /><i /><i /></div><p className="muted small"><LoaderCircle className="spin" size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> Loading the statement…</p></div>
        ) : null}

        {t ? (
          <dl className="summary">
            <div><dt>Cases opened</dt><dd>{t.cases}</dd></div>
            <div><dt>People helped</dt><dd>{t.people}</dd></div>
            <div><dt>Donated (mock)</dt><dd>{fmtVnd(t.donatedVnd)}</dd></div>
            <div><dt>Paid out · {t.paidCases} {t.paidCases === 1 ? "case" : "cases"}</dt><dd>{fmtVnd(t.paidVnd)}</dd></div>
            <div className="zero-row"><dt>Personal records published</dt><dd><b>{t.personalDataPublished}</b></dd></div>
            <div className="zero-row"><dt>Names, IDs, addresses, medical files</dt><dd><Redacted size="l" /></dd></div>
          </dl>
        ) : null}

        {t ? (
          <div className="statement-sec" style={{ paddingTop: "0.9rem" }}>
            <div className="progress-row">
              <strong>Funding progress</strong>
              <span className="small muted"> {fmtVnd(t.donatedVnd)} of {fmtVnd(t.requestedVnd)} requested</span>
            </div>
            <div className="bar" role="progressbar" aria-label="Funding progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct(t.donatedVnd, t.requestedVnd)}>
              <span style={{ width: `${pct(t.donatedVnd, t.requestedVnd)}%` }} />
            </div>
          </div>
        ) : null}

        <div className="statement-sec">
          <h3 id="ledger-h">Payout ledger</h3>
        </div>
        {data && !data.ledger.length ? (
          <div className="empty">
            <BookOpenCheck size={22} aria-hidden />
            <p><strong>No payouts yet.</strong> The first payout appears here once 2 of 3 council seals are in and the hospital collects it.</p>
          </div>
        ) : null}
        {data?.ledger.length ? (
          <div className="tablewrap">
            <table className="table" aria-labelledby="ledger-h">
              <thead><tr><th>Time</th><th>Transaction ref</th><th>Paid to</th><th>Recipient</th><th>Case</th><th>Approved by</th><th className="amt">Amount</th></tr></thead>
              <tbody>
                {data.ledger.map((l) => (
                  <tr key={l.txRef}>
                    <td data-label="Time" className="nowrap">{fmtDateTime(l.at)}</td>
                    <td data-label="Transaction ref"><code>{l.txRef}</code></td>
                    <td data-label="Paid to">{l.payeeName}</td>
                    <td data-label="Recipient"><Redacted size="m" /></td>
                    <td data-label="Case"><code>{l.caseId}</code></td>
                    <td data-label="Approved by" className="nowrap">{l.approvedBy}</td>
                    <td data-label="Amount" className="amt">{fmtVnd(l.amountVnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="legend">
          <Redacted size="s" /> Black bars hide the recipient&apos;s details to protect them. The mock bank records a payout only when the hospital&apos;s Tide-signed token carries the case&apos;s payout group, which means 2 of 3 council members approved.
        </p>
      </section>

      <section className="statement" aria-labelledby="cases-h">
        <div className="statement-head">
          <h2 id="cases-h">Cases and seals</h2>
          <span className="when">Two seals unlock a payout</span>
        </div>
        {loading ? <div className="statement-sec"><div className="skel" aria-hidden><i /><i /><i /></div></div> : null}
        {data && !data.cases.length ? (
          <div className="empty">
            <ClipboardList size={22} aria-hidden />
            <p><strong>No cases yet.</strong> When a volunteer seals the first case it appears here with only the province, household size and amount.</p>
          </div>
        ) : null}
        {data?.cases.length ? (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr><th>Case</th><th>Province · people</th><th>Status</th><th>Paid to</th><th>Seals</th><th>Donated</th><th className="amt">Requested</th></tr>
              </thead>
              <tbody>
                {data.cases.map((c) => (
                  <tr key={c.caseId}>
                    <td data-label="Case"><code>{c.caseId}</code></td>
                    <td data-label="Province · people"><div className="cell">{c.province}<span className="small muted">{c.householdSize} {c.householdSize === 1 ? "person" : "people"}</span></div></td>
                    <td data-label="Status"><StatusChip status={c.status} /></td>
                    <td data-label="Paid to"><div className="cell">{c.proposal ? <>{c.proposal.payeeName}<span className="small muted">{fmtVnd(c.proposal.amountVnd)}</span>{c.paidAt ? <span className="small muted">{fmtDateTime(c.paidAt)} · <code>{c.txRef}</code></span> : null}</> : <span className="muted">No payout proposed</span>}</div></td>
                    <td data-label="Seals"><PublicSeals approvals={c.approvals} /></td>
                    <td data-label="Donated">
                      <div className="cell">
                        <div className="bar bar-sm"><span style={{ width: `${pct(c.donatedVnd, c.amountVnd)}%` }} /></div>
                        <span className="small muted">{fmtVnd(c.donatedVnd)}</span>
                      </div>
                    </td>
                    <td data-label="Requested" className="amt">{fmtVnd(c.amountVnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="legend">Each seal is one council member&apos;s approval and the number inside is their seat. This page receives roles and timestamps, never names.</p>
      </section>

      <DonateForm cases={data?.cases ?? []} onDone={load} />

      <section className="card" aria-labelledby="events-h">
        <div className="card-head">
          <div>
            <h2 id="events-h">Public log</h2>
            <p className="card-sub">Roles and timestamps only. No names.</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={15} aria-hidden /> Refresh</button>
        </div>
        {loading ? <div className="skel" aria-hidden><i /><i /><i /></div> : null}
        {data && !data.events.length ? <p className="muted">No events yet. Every seal, proposal and approval is recorded here.</p> : null}
        <ol className="timeline">
          {data?.events.map((e, i) => {
            const l = EVENT[e.action] ?? { Icon: Circle, text: e.action };
            return (
              <li key={`${e.at}-${i}`} className={e.action === "council.approved" || e.action === "bank.payout" ? "tl-ok" : e.action.endsWith("refused") || e.action === "bank.denied" ? "tl-lock" : undefined}>
                <span className="tl-dot" aria-hidden><l.Icon size={14} /></span>
                <div className="tl-body">
                  <strong>{l.text}</strong>
                  <div className="small muted">{fmtDateTime(e.at)} · {e.actorRole} · case <code>{e.caseId}</code></div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {data?.donations.length ? (
        <section className="card" aria-labelledby="don-h">
          <h2 id="don-h">Recent donations (mock)</h2>
          <ul className="donlist">
            {data.donations.slice(0, 10).map((d, i) => (
              <li key={i}><strong>{d.name}</strong> <span>{fmtVnd(d.amountVnd)}</span> <span className="small muted" style={{ flexBasis: "100%" }}>{d.caseId ? `Case ${d.caseId}` : "General fund"} · {fmtDateTime(d.at)}</span></li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function DonateForm({ cases, onDone }: { cases: PubCase[]; onDone: () => void }) {
  const [amount, setAmount] = useState("200000");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), name: name.trim() || undefined, caseId: target || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error ?? `${res.status}`);
      setMsg({ ok: true, text: `Thank you, ${name.trim() || "Anonymous"}. Recorded ${fmtVnd(Number(amount))} (mock: no real money moves).` });
      setName("");
      onDone();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card donate" aria-labelledby="donate-h">
      <div className="card-head">
        <div>
          <h2 id="donate-h">Make a donation</h2>
          <p className="card-sub">Demo only: no real payment is made. The display name is optional, so please do not enter personal details.</p>
        </div>
      </div>
      <form onSubmit={submit} className="stack">
        <div className="chips" role="group" aria-label="Quick amounts">
          {[100000, 200000, 500000, 1000000].map((v) => (
            <button type="button" key={v} className={`chip chipbtn ${Number(amount) === v ? "chip-teal" : ""}`} aria-pressed={Number(amount) === v} onClick={() => setAmount(String(v))}>{fmtVnd(v)}</button>
          ))}
        </div>
        <div className="formgrid">
          <div>
            <label htmlFor="d-amt">Amount (VND)</label>
            <input id="d-amt" type="number" min={1000} step={1000} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="d-name">Display name (optional)</label>
            <input id="d-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Anonymous" />
          </div>
          <div>
            <label htmlFor="d-case">Give to</label>
            <select id="d-case" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">General fund</option>
              {cases.map((c) => <option key={c.caseId} value={c.caseId}>Case {c.caseId} · {c.province}</option>)}
            </select>
          </div>
        </div>
        <div className="row">
          <button className="btn btn-primary" disabled={busy || !Number(amount)}>{busy ? <><LoaderCircle className="spin" size={18} aria-hidden /> Sending…</> : <><HandHeart size={18} aria-hidden /> Donate (mock)</>}</button>
          {Number(amount) && !msg ? <span className="muted small">{fmtVnd(Number(amount))}</span> : null}
          {msg ? <span role="status" className={msg.ok ? "donate-ok" : "donate-bad"}>{msg.ok ? <CircleCheck size={18} aria-hidden /> : <TriangleAlert size={18} aria-hidden />}{msg.text}</span> : null}
        </div>
      </form>
    </section>
  );
}
