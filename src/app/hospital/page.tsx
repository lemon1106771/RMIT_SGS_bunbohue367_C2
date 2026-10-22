"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleCheck, HandCoins, KeyRound, LoaderCircle, LockOpen, LogOut, ShieldX, Hospital as HospitalIcon, X } from "lucide-react";
import { QuorumSeals, seatsFromCase } from "@/components/Seal";
import { useTideCloak } from "@tidecloak/nextjs";
import { RequireLogin } from "@/components/Gate";
import { PageHeader } from "@/components/PageHeader";
import { ErrorBox } from "@/components/ErrorBox";
import { SecretView } from "@/components/SecretView";
import { StatusChip } from "@/components/StatusChip";
import { ApiError, useApi } from "@/lib/client/api";
import { reportDecrypt } from "@/lib/client/audit";
import { explainError } from "@/lib/client/errors";
import { useIdentity } from "@/lib/client/identity";
import { decryptForRecord } from "@/lib/tide/relationship";
import { ENTRY_KINDS, QUORUM, fmtVnd, payoutGroupFor, type EntryKind } from "@/lib/cases";
import { fmtDateTime, type CaseDto, type EntryDto, type PolicyDto, type Receipt } from "@/lib/client/types";

export default function HospitalPage() {
  return (
    <RequireLogin title="Hospital">
      <Hospital />
    </RequireLogin>
  );
}

function Hospital() {
  const api = useApi();
  const { groups } = useIdentity();
  const [cases, setCases] = useState<CaseDto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await api<{ cases: CaseDto[] }>("/api/cases");
      setCases(r.cases);
    } catch (e) {
      setLoadError(e);
    } finally {
      setLoaded(true);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader title="Hospital" purpose="Collect the payout the council approved. The mock bank trusts only your Tide-signed token, so there is no password and no override." signedIn />

      <p className="token-line">
        <KeyRound size={16} aria-hidden />
        <span>Groups in your sign-in token:</span>
        {groups.length ? groups.map((g) => <code key={g} className="chip">{g}</code>) : <span className="muted">none yet</span>}
      </p>

      <ErrorBox error={loadError} title="Could not load cases" />
      {!loaded ? <div className="card" role="status" aria-busy="true" aria-label="Loading cases"><div className="skel"><i /><i /><i /></div></div> : null}
      {loaded && !cases.length && !loadError ? (
        <div className="card empty" role="status">
          <HospitalIcon size={22} aria-hidden />
          <p><strong>No cases for you yet.</strong> When the fund proposes a payout to this hospital, the case appears here with the council&apos;s seals.</p>
        </div>
      ) : null}
      <div className="stack">
        {cases.map((c) => <CasePayout key={c.caseId} c={c} onChanged={load} />)}
      </div>
    </>
  );
}

type Collect =
  | { state: "working" }
  | { state: "paid"; receipt: Receipt; replay: boolean }
  | { state: "denied"; message: string }
  | { state: "error"; error: unknown };

type Opened =
  | { state: "working" }
  | { state: "ok"; items: { entry: EntryDto; text: string }[] }
  | { state: "locked" }
  | { state: "nopolicy" }
  | { state: "empty" }
  | { state: "error"; error: unknown };

const DENIED_DEFAULT = "Refused: your sign-in token does not carry this case's payout group. A payout needs 2 of 3 council approvals in TideCloak.";

function CasePayout({ c, onChanged }: { c: CaseDto; onChanged: () => void | Promise<void> }) {
  const api = useApi();
  const { logout } = useTideCloak();
  const [collect, setCollect] = useState<Collect | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);

  const receipt: Receipt | null = collect?.state === "paid" ? collect.receipt : c.receipt;

  // The click goes straight to the mock bank. Its answer depends on the groups claim in the Tide-signed token.
  async function receive() {
    setCollect({ state: "working" });
    try {
      const r = await api<{ receipt: Receipt; replay: boolean }>("/api/bank/payout", { method: "POST", body: { caseId: c.caseId } });
      setCollect({ state: "paid", receipt: r.receipt, replay: r.replay });
      await onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        const b = (e.body ?? {}) as { message?: string };
        setCollect({
          state: "denied",
          message: b.message ?? DENIED_DEFAULT,
        });
      } else if (e instanceof ApiError && e.status === 409 && (e.body as { error?: string } | null)?.error === "no_proposal") {
        setCollect({ state: "error", error: new Error("The fund has not proposed a payout for this case yet.") });
      } else {
        setCollect({ state: "error", error: e });
      }
    }
  }

  // EXTENSION: open the sealed family file (Tide encryption policies). A refusal is shown once, never retried.
  async function openFile() {
    setOpened({ state: "working" });
    try {
      const p = await api<{ policies: PolicyDto[] }>(`/api/policies?record=${encodeURIComponent(c.recordId)}`);
      const policy = p.policies.find((x) => x.subjectType === "Group");
      if (!policy) {
        setOpened({ state: "nopolicy" });
        return;
      }
      const e = await api<{ entries: EntryDto[] }>(`/api/entries?record=${encodeURIComponent(c.recordId)}`);
      if (!e.entries.length) {
        setOpened({ state: "empty" });
        return;
      }
      const items: { entry: EntryDto; text: string }[] = [];
      for (const entry of e.entries) {
        items.push({ entry, text: await decryptForRecord(entry.ciphertext, c.recordId, policy.policyB64) });
      }
      items.sort((a, b) => ENTRY_KINDS.indexOf(a.entry.kind as EntryKind) - ENTRY_KINDS.indexOf(b.entry.kind as EntryKind));
      setOpened({ state: "ok", items });
      void reportDecrypt(api, c.recordId, { ok: true, detail: `hospital opened ${items.length} items (content is never sent to the server)` });
    } catch (err) {
      const x = explainError(err);
      if (x.refused) {
        setOpened({ state: "locked" });
        void reportDecrypt(api, c.recordId, { ok: false, error: err });
      } else {
        setOpened({ state: "error", error: err });
      }
    }
  }

  const proposal = c.proposal;

  return (
    <article className="card casecard">
      <div className="card-head">
        <div>
          <h2>Case <code className="id">{c.caseId}</code></h2>
          <p className="card-sub">{c.province} · {c.householdSize} {c.householdSize === 1 ? "person" : "people"} · requested {fmtVnd(c.amountVnd)}</p>
        </div>
        <StatusChip status={c.status} />
      </div>

      {receipt ? (
        <p>The fund paid <strong>{fmtVnd(receipt.amountVnd)}</strong> straight to <strong>{receipt.payeeName}</strong> once {QUORUM} of 3 council members had approved.</p>
      ) : proposal ? (
        <p>
          The fund proposes paying <strong>{fmtVnd(proposal.amountVnd)}</strong> straight to <strong>{proposal.payeeName}</strong>.
          {" "}{QUORUM} of 3 council members must approve adding account <code>{proposal.payee}</code> to group <code>{payoutGroupFor(c.caseId)}</code>.
        </p>
      ) : (
        <p className="muted">The fund has not proposed a payout for this case yet.</p>
      )}

      {proposal ? <QuorumSeals seats={seatsFromCase(c)} size={72} /> : null}

      {receipt ? <ReceiptCard r={receipt} replay={collect?.state === "paid" && collect.replay} /> : null}

      {!receipt ? (
        <div className="row pay">
          <button className="btn btn-primary btn-big" onClick={receive} disabled={collect?.state === "working"}>
            {collect?.state === "working" ? <><LoaderCircle className="spin" size={18} aria-hidden /> Asking the bank…</> : <><HandCoins size={18} aria-hidden /> Collect payout</>}
          </button>
        </div>
      ) : null}

      {collect?.state === "denied" ? (
        <div className="locked-state" role="alert">
          <ShieldX className="big" size={28} aria-hidden />
          <h2>Payout refused</h2>
          <p className="reason">{collect.message}</p>
          <p>
            Next step: once a second council member approves under Change requests in TideCloak, sign out and sign in again so your token carries the new group (this can take up to 2 minutes), then click Collect payout again.
          </p>
          <div className="row">
            <button className="btn btn-primary" onClick={() => logout()}><LogOut size={18} aria-hidden /> Sign out and sign in again</button>
            <button className="btn btn-ghost" onClick={() => setCollect(null)}><X size={16} aria-hidden /> Dismiss</button>
          </div>
        </div>
      ) : null}
      {collect?.state === "error" ? <ErrorBox error={collect.error} title="Could not collect the payout" /> : null}

      <details className="ext">
        <summary>Optional: open the sealed file</summary>
        <p className="muted small">The hospital can read the family file a volunteer sealed, but only once its account is in the payout group. The decryption runs in your browser.</p>
        {!opened || opened.state === "working" ? (
          <button className="btn btn-ghost" onClick={openFile} disabled={opened?.state === "working"}>{opened?.state === "working" ? <><LoaderCircle className="spin" size={18} aria-hidden /> Asking the Tide network…</> : <><LockOpen size={18} aria-hidden /> Open sealed file</>}</button>
        ) : null}

        {opened?.state === "nopolicy" ? (
          <div className="notice notice-lock" role="status">
            <strong>This file is not ready for you yet.</strong>
            <p>The council has not sealed the file with a Tide access rule, or your account is not the designated hospital.</p>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpened(null)}>Dismiss</button>
          </div>
        ) : null}
        {opened?.state === "empty" ? (
          <div className="notice notice-info" role="status">
            The volunteer has not sent any encrypted items yet.
            <div><button className="btn btn-ghost btn-sm" onClick={() => setOpened(null)}>Dismiss</button></div>
          </div>
        ) : null}
        {opened?.state === "error" ? (
          <>
            <ErrorBox error={opened.error} title="Could not open the file" />
            <button className="btn btn-ghost btn-sm" onClick={() => setOpened(null)}>Dismiss</button>
          </>
        ) : null}
        {opened?.state === "locked" ? (
          <div className="locked-state" role="alert">
            <ShieldX className="big" size={28} aria-hidden />
            <h2>Sealed file stays locked</h2>
            <p className="reason">The Tide network refused to decrypt this file because the council has not approved enough yet. This is by design.</p>
            <p>After the second approval, sign out and sign in again (your token can take up to 2 minutes to carry the new group).</p>
            <div className="row">
              <button className="btn btn-primary" onClick={() => logout()}><LogOut size={18} aria-hidden /> Sign out and sign in again</button>
              <button className="btn btn-ghost" onClick={() => setOpened(null)}><X size={16} aria-hidden /> Dismiss</button>
            </div>
          </div>
        ) : null}
        {opened?.state === "ok" ? (
          <div className="stack" style={{ marginTop: "0.8rem" }}>
            <div className="notice notice-ok" role="status">
              <strong>File opened.</strong> Decrypted in your browser only; the server never receives the contents.
            </div>
            {opened.items.map((it) => <SecretView key={it.entry.id} kind={it.entry.kind} text={it.text} />)}
            <div><button className="btn btn-ghost btn-sm" onClick={() => setOpened(null)}>Hide</button></div>
          </div>
        ) : null}
      </details>
    </article>
  );
}

function ReceiptCard({ r, replay }: { r: Receipt; replay: boolean }) {
  return (
    <div className="receipt" role="status">
      <div className="receipt-top">
        <span className="receipt-icon"><CircleCheck size={22} aria-hidden /></span>
        <div>
          <strong>Paid out</strong>
          <span className="s">Mock bank · no real money moved</span>
        </div>
      </div>
      <div className="receipt-amount">{fmtVnd(r.amountVnd)}</div>
      <dl>
        <dt>Transaction ref</dt><dd><code>{r.txRef}</code></dd>
        <dt>Paid to</dt><dd>{r.payeeName}</dd>
        <dt>Time</dt><dd>{fmtDateTime(r.at)}</dd>
      </dl>
      {replay ? <p>This payout was already recorded, so the bank returned the original receipt.</p> : null}
    </div>
  );
}
