"use client";

import Link from "next/link";
import { useReducer } from "react";
import { ArrowRight, CircleCheck, HandCoins, HeartHandshake, LockKeyhole, RotateCcw, ShieldX } from "lucide-react";
import { QuorumSeals } from "@/components/Seal";
import { COUNCIL_ROLES, fmtVnd } from "@/lib/cases";
import { advanceDemo, initialDemoState, type Seat } from "@/lib/demo/payout";

const AMOUNT = 50_000_000;

export default function DemoPage() {
  const [state, dispatch] = useReducer(advanceDemo, undefined, initialDemoState);
  const count = state.approvals.filter(Boolean).length;
  const seats = COUNCIL_ROLES.map((role, i) => ({
    role: role.title,
    name: "",
    approved: state.approvals[i],
    mark: ["F", "R", "D"][i],
  }));

  return (
    <>
      <header className="demo-intro">
        <span className="chip chip-teal">Interactive prototype · simulated decisions</span>
        <h1>A family gets care. Donors can verify where the money went.</h1>
        <p>Follow one made-up case in Quang Binh. The family does not publish an ID or medical file, yet the fund can pay the hospital after two independent council approvals.</p>
      </header>

      <div className="demo-layout">
        <section className="card demo-family" aria-labelledby="family-h">
          <div className="card-head">
            <div>
              <h2 id="family-h">The family's need</h2>
              <p className="card-sub">Case QB-2041 · child's surgery · Quang Binh</p>
            </div>
            <HeartHandshake size={24} aria-hidden />
          </div>
          <dl className="demo-facts">
            <div><dt>Amount needed</dt><dd>{fmtVnd(AMOUNT)}</dd></div>
            <div><dt>Payee</dt><dd>Hoa Binh Hospital (mock)</dd></div>
            <div><dt>Family identity</dt><dd><span className="redact redact-m" role="img" aria-label="private" /></dd></div>
            <div><dt>Medical file</dt><dd><LockKeyhole size={16} aria-hidden /> Sealed from the public</dd></div>
          </dl>
          <p className="hint">Only the case, amount and hospital are public in this demonstration.</p>
        </section>

        <section className="card demo-action" aria-labelledby="action-h">
          <div className="card-head">
            <div>
              <h2 id="action-h">Can the hospital collect?</h2>
              <p className="card-sub">Try before approval, after one seal, and after two.</p>
            </div>
            <span className={`chip ${state.status === "paid" ? "chip-ok" : ""}`}>{state.status === "paid" ? "Paid" : `${count} of 2 approvals`}</span>
          </div>
          <button className="btn btn-primary btn-big" onClick={() => dispatch({ type: "collect" })} disabled={state.status === "paid"}>
            <HandCoins size={18} aria-hidden /> {state.status === "paid" ? "Payout collected" : "Hospital: collect payout"}
          </button>
          <div className={`demo-result ${state.status}`} role="status" aria-live="polite">
            {state.status === "denied" ? <><ShieldX size={24} aria-hidden /><div><strong>Payout refused</strong><p>{count} of 2 approvals. The hospital has no payout authority yet.</p></div></> : null}
            {state.status === "paid" ? <><CircleCheck size={24} aria-hidden /><div><strong>Hospital paid</strong><p>{fmtVnd(AMOUNT)} went directly to Hoa Binh Hospital (mock).</p></div></> : null}
            {state.status === "ready" ? <><LockKeyhole size={24} aria-hidden /><div><strong>{count >= 2 ? "Ready for the hospital" : "Payment is locked"}</strong><p>{count >= 2 ? "Two council members approved. Ask the hospital to collect." : "The bank will refuse until two council members approve."}</p></div></> : null}
          </div>
        </section>
      </div>

      <section className="card demo-council" aria-labelledby="council-h">
        <div className="card-head">
          <div>
            <h2 id="council-h">The council decides together</h2>
            <p className="card-sub">Choose any two distinct members. One approval never releases the payout.</p>
          </div>
        </div>
        <div className="demo-approval-actions">
          {COUNCIL_ROLES.map((role, index) => (
            <button
              className={`btn ${state.approvals[index] ? "btn-ghost" : "btn-primary"}`}
              key={role.title}
              onClick={() => dispatch({ type: "approve", seat: index as Seat })}
              disabled={state.approvals[index] || state.status === "paid"}
              aria-pressed={state.approvals[index]}
            >
              {state.approvals[index] ? <CircleCheck size={16} aria-hidden /> : null}
              {role.title}: {state.approvals[index] ? "approved" : "approve"}
            </button>
          ))}
        </div>
        <QuorumSeals seats={seats} size={76} />
      </section>

      <div className="demo-layout">
        <section className="card demo-ledger" aria-labelledby="ledger-h">
          <h2 id="ledger-h">What a donor can verify</h2>
          <p className="card-sub">The public record shows the payment, never the family's identity.</p>
          {state.status === "paid" ? (
            <dl className="demo-facts demo-receipt">
              <div><dt>Case</dt><dd>QB-2041</dd></div>
              <div><dt>Paid to</dt><dd>Hoa Binh Hospital (mock)</dd></div>
              <div><dt>Amount</dt><dd>{fmtVnd(AMOUNT)}</dd></div>
              <div><dt>Approval</dt><dd>2 of 3 council members</dd></div>
              <div><dt>Reference</dt><dd>DEMO-QB-2041</dd></div>
            </dl>
          ) : <p className="demo-empty">No payout receipt yet. The donor can see that the hospital has not been paid.</p>}
        </section>
        <section className="card demo-events" aria-labelledby="events-h">
          <h2 id="events-h">What just happened</h2>
          <ol aria-live="polite">
            {[...state.events].reverse().map((event) => <li key={event.id} className={`demo-event-${event.tone}`}>{event.text}</li>)}
          </ol>
        </section>
      </div>

      <div className="demo-bottom">
        <button className="btn btn-ghost" onClick={() => dispatch({ type: "reset" })}><RotateCcw size={16} aria-hidden /> Start again</button>
        <p><strong>This is a simulation.</strong> No money moves and no Tide approval is issued here. In the live workflow, TideCloak governs the hospital&apos;s case group and the mock bank verifies the Tide-signed token and DPoP proof.</p>
        <Link href="/public" className="btn btn-ghost">Open the live public ledger <ArrowRight size={16} aria-hidden /></Link>
      </div>
    </>
  );
}
