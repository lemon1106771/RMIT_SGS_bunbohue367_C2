"use client";
import { useState } from "react";
import { LoaderCircle, Stamp } from "lucide-react";
import { QuorumSeals, seatsFromCase } from "@/components/Seal";
import { useApi } from "@/lib/client/api";
import { useIdentity } from "@/lib/client/identity";
import { ErrorBox } from "@/components/ErrorBox";
import { QUORUM, fmtVnd } from "@/lib/cases";
import type { CaseDto } from "@/lib/client/types";

/**
 * "Council seals": the 3 council seats of one case and who has said "I approve this payout" in the app.
 * It is a statement in the audit log, NOT the security gate (the TideCloak change request is).
 */
export function TrusteeStatus({ c, onChanged }: { c: CaseDto; onChanged?: () => void }) {
  const api = useApi();
  const { username, isAdmin } = useIdentity();
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const approved = new Set(c.approvals.map((a) => a.actor));
  const count = c.council.filter((m) => approved.has(m)).length;
  const iAmListed = c.council.includes(username);

  async function approve() {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/audit", {
        method: "POST",
        body: { action: "council.approved", recordId: c.recordId, detail: `${username}: I approve this payout of ${fmtVnd(c.proposal?.amountVnd ?? c.amountVnd)} for case ${c.caseId}` },
      });
      onChanged?.();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="seals-h">
      <div className="card-head">
        <div>
          <h2 id="seals-h">Council seals</h2>
          <p className="card-sub">Each seal is one council member&apos;s public approval. Two of three unlock the payout.</p>
        </div>
      </div>
      <ErrorBox error={err} />
      {!c.proposal ? (
        <div className="empty" style={{ padding: "8px 0" }}>
          <Stamp size={20} aria-hidden />
          <p><strong>Nothing to seal yet.</strong> Propose a payout above first; the seats appear once the fund has made a proposal.</p>
        </div>
      ) : (
        <>
          <QuorumSeals seats={seatsFromCase(c)} />
          <p className="muted small" style={{ marginTop: 12 }}>{count} of {c.council.length} members have logged an approval; {QUORUM} are needed.</p>
          {isAdmin && iAmListed && !approved.has(username) && c.status !== "paid" ? (
            <div className="row">
              <button className="btn btn-primary" onClick={approve} disabled={busy}>
                {busy ? <><LoaderCircle className="spin" size={18} aria-hidden /> Logging…</> : <><Stamp size={18} aria-hidden /> Log my approval publicly</>}
              </button>
              <span className="hint" style={{ margin: 0 }}>Only writes a line in the public log. The binding approval happens in TideCloak under Change requests.</span>
            </div>
          ) : null}
          {!iAmListed ? <p className="muted small">You do not hold a seat on this case&apos;s council, so there is no approval button for you.</p> : null}
        </>
      )}
      <div className="notice notice-info small">
        <strong>What this button does.</strong> “Log my approval publicly” only adds a line to the app&apos;s public log so donors can see who agreed. It does not unlock anything.
        The real gate is a change request in TideCloak: the hospital joins the payout group only after 2 of 3 realm admins approve it. Then the hospital&apos;s Tide token carries that group, and the mock bank trusts nothing else.
      </div>
    </section>
  );
}
