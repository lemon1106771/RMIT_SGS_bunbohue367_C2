"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleCheck, CircleX, KeyRound, LoaderCircle, RefreshCw, ShieldAlert, ShieldX } from "lucide-react";
import { useTideCloak } from "@tidecloak/nextjs";
import { RequireLogin } from "@/components/Gate";
import { PageHeader } from "@/components/PageHeader";
import { ErrorBox } from "@/components/ErrorBox";
import { useApi } from "@/lib/client/api";
import { reportDecrypt } from "@/lib/client/audit";
import { explainError } from "@/lib/client/errors";
import { useIdentity } from "@/lib/client/identity";
import { decryptForRecord } from "@/lib/tide/relationship";
import { KIND_LABEL, payoutGroupFor, type EntryKind } from "@/lib/cases";
import type { EntryDto, PolicyDto } from "@/lib/client/types";

export default function OperatorPage() {
  return (
    <RequireLogin title="Fund owner">
      <OperatorGate />
    </RequireLogin>
  );
}

function OperatorGate() {
  const { isAdmin } = useIdentity();
  if (isAdmin) return <Operator />;
  return (
    <>
      <PageHeader title="Fund owner" purpose="A council member can inspect the fund's progress without seeing a family's private file." signedIn />
      <div className="notice notice-lock" role="status">This view is for council members.</div>
    </>
  );
}

interface Inspection {
  counts: { cases: number; ciphertextItems: number; signedPolicies: number; auditEvents: number };
  firstCaseId: string | null;
  firstEntry: EntryDto | null;
  candidatePolicies: PolicyDto[];
}

type Verdict = { valid: boolean; reason?: string; groups?: string[] };
type Forge =
  | { state: "working" }
  | { state: "done"; group: string; real: Verdict; fake: Verdict }
  | { state: "error"; error: unknown };

const b64uToStr = (s: string) => {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b + "=".repeat((4 - (b.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};
const strToB64u = (s: string) => {
  let bin = "";
  new TextEncoder().encode(s).forEach((x) => (bin += String.fromCharCode(x)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function verifyToken(token: string): Promise<Verdict> {
  // no login needed: this endpoint only checks the Tide signature
  const res = await fetch("/api/bank/verify-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), cache: "no-store" });
  return (await res.json()) as Verdict;
}

type Attempt =
  | { state: "working" }
  | { state: "none" }
  | { state: "ok"; entry: EntryDto; via: string; length: number }
  | { state: "refused"; entry: EntryDto; via: string }
  | { state: "error"; error: unknown };

function Operator() {
  const api = useApi();
  const { username, groups, isAdmin } = useIdentity();
  const { token } = useTideCloak();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [forge, setForge] = useState<Forge | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setInspection(await api<Inspection>("/api/operator/inspection"));
    } catch (e) {
      setErr(e);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  // Try the first item with whatever policy THIS caller gets. Wrong person: the network says no.
  async function tryOpen() {
    setAttempt({ state: "working" });
    try {
      const fresh = await api<Inspection>("/api/operator/inspection");
      setInspection(fresh);
      const entry = fresh.firstEntry;
      if (!entry) {
        setAttempt({ state: "none" });
        return;
      }
      // 1) a policy this caller gets, 2) otherwise a signed policy held by the server.
      const mine = await api<{ policies: PolicyDto[] }>(`/api/policies?record=${encodeURIComponent(entry.recordId)}`);
      const forRecord = fresh.candidatePolicies;
      let policy = mine.policies[0];
      let via = policy ? `a policy that applies to you (${policy.subjectType} ${policy.subjectId.slice(0, 28)}…)` : "";
      if (!policy) {
        policy = forRecord.find((p) => p.subjectType === "Group") ?? forRecord[0];
        via = policy ? `a signed policy stored by the fund (${policy.subjectType} ${policy.subjectId.slice(0, 28)}…): you hold the policy file but not the permission` : "";
      }
      if (!policy) {
        setAttempt({ state: "none" });
        return;
      }
      try {
        const text = await decryptForRecord(entry.ciphertext, entry.recordId, policy.policyB64);
        setAttempt({ state: "ok", entry, via, length: text.length }); // never keep or show the plaintext here
        void reportDecrypt(api, entry.recordId, { ok: true, detail: "fund owner tried to open with their own access" });
      } catch (e) {
        const x = explainError(e);
        if (x.refused) {
          setAttempt({ state: "refused", entry, via });
          void reportDecrypt(api, entry.recordId, { ok: false, error: e, detail: "fund owner tried to open" });
        } else {
          setAttempt({ state: "error", error: e });
        }
      }
    } catch (e) {
      setAttempt({ state: "error", error: e });
    }
  }

  // Take my real token, add a payout group to the payload, keep the OLD signature, and ask the bank's verifier.
  async function tryForge() {
    setForge({ state: "working" });
    try {
      if (!token) throw new Error("No access token yet.");
      const [h, p, sig] = token.split(".");
      if (!h || !p || !sig) throw new Error("The access token is not a JWT.");
      const first = inspection?.firstCaseId ?? "demo";
      const group = payoutGroupFor(first);
      const payload = JSON.parse(b64uToStr(p)) as Record<string, unknown>;
      const forged = `${h}.${strToB64u(JSON.stringify({ ...payload, groups: [group] }))}.${sig}`;
      const [real, fake] = await Promise.all([verifyToken(token), verifyToken(forged)]);
      setForge({ state: "done", group, real, fake });
    } catch (e) {
      setForge({ state: "error", error: e });
    }
  }

  const counts = inspection
    ? [
        { n: inspection.counts.cases, label: "cases" },
        { n: inspection.counts.ciphertextItems, label: "sealed items" },
        { n: inspection.counts.signedPolicies, label: "signed policies" },
        { n: inspection.counts.auditEvents, label: "audit events" },
      ]
    : [];

  return (
    <>
      <PageHeader title="Fund owner" purpose="See how help is moving, while the family's private file stays sealed." signedIn />

      <ErrorBox error={err} title="Could not load the fund summary" />

      <section className="card" aria-labelledby="summary-h">
        <div className="card-head">
          <div>
            <h2 id="summary-h">Fund progress</h2>
            <p className="card-sub">A compact view of cases and sealed files. Family details are not shown here.</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={15} aria-hidden /> Refresh</button>
        </div>
        {inspection ? (
          <div className="counts">
            {counts.map((c) => (
              <div key={c.label}><strong>{c.n}</strong><span>{c.label}</span></div>
            ))}
          </div>
        ) : !err ? <div className="skel" role="status" aria-busy="true" aria-label="Loading the fund summary"><i /><i /><i /></div> : null}
        <p className="muted small" style={{ marginBottom: 0 }}>The server stores sealed items, while Tide policies decide who can open them. This view does not publish account identifiers or a database dump.</p>
      </section>

      <section className="card" aria-labelledby="try-h">
        <div className="card-head">
          <div>
            <h2 id="try-h">Try to open a file with my own access</h2>
            <p className="card-sub">
              You are <strong>{username}</strong>{isAdmin ? " (council member)" : ""}{groups.length ? <>, in {groups.map((g) => <code key={g} style={{ marginRight: 4 }}>{g}</code>)}</> : ", in no group"}.
              The button asks the Tide network to decrypt the first encrypted item with exactly the access you hold now.
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={tryOpen} disabled={attempt?.state === "working"}>
          {attempt?.state === "working" ? <><LoaderCircle className="spin" size={18} aria-hidden /> Asking the Tide network…</> : <><KeyRound size={18} aria-hidden /> Try to open the first item</>}
        </button>

        {attempt?.state === "none" ? <div className="notice notice-info" role="status">There is no encrypted item or policy to try yet. Ask a volunteer to seal a case first.</div> : null}
        {attempt?.state === "error" ? <ErrorBox error={attempt.error} title="Could not run the attempt" /> : null}
        {attempt?.state === "refused" ? (
          <div className="locked-state" role="alert">
            <ShieldX className="big" size={28} aria-hidden />
            <h2>Blocked, by design</h2>
            <p className="reason">The Tide network refused to decrypt the <strong>{KIND_LABEL[attempt.entry.kind as EntryKind]?.label ?? attempt.entry.kind}</strong> item of <code>{attempt.entry.recordId}</code>.</p>
            <p>Holding a sealed file is not the same as holding its key. The fund owner and the server admin do not have this access.</p>
            <p className="small muted">Tried with {attempt.via}.</p>
          </div>
        ) : null}
        {attempt?.state === "ok" ? (
          <div className="notice notice-ok" role="status">
            <strong>Opened ({attempt.length} characters).</strong> Your access matches a policy for <code>{attempt.entry.recordId}</code>: {attempt.via}.
            The contents are not shown here or sent anywhere.
          </div>
        ) : null}
      </section>

      <section className="card" aria-labelledby="forge-h">
        <div className="card-head">
          <div>
            <h2 id="forge-h">Forge a payout token</h2>
            <p className="card-sub">
              If the bank only reads the groups in a token, why not add one yourself? The button takes your current access token, <strong>edits its payload</strong> to include <code>{payoutGroupFor(inspection?.firstCaseId ?? "…")}</code>, <strong>keeps the old signature</strong>, and sends it to the bank&apos;s verifier.
            </p>
          </div>
        </div>
        <button className="btn btn-danger" onClick={tryForge} disabled={forge?.state === "working"}>
          {forge?.state === "working" ? <><LoaderCircle className="spin" size={18} aria-hidden /> Checking…</> : <><ShieldAlert size={18} aria-hidden /> Try to forge payout authority</>}
        </button>
        {forge?.state === "error" ? <ErrorBox error={forge.error} title="Could not run the attempt" /> : null}
        {forge?.state === "done" ? (
          <>
            {!forge.fake.valid ? (
              <div className="locked-state" role="alert">
                <ShieldX className="big" size={28} aria-hidden />
                <h2>Forged token rejected</h2>
                <p className="reason">The verifier says: <code>{forge.fake.reason}</code></p>
                <p>The signing key is split across the Tide network. Nobody, not even the server admin, can sign a token alone, so a token edited after signing never verifies.</p>
              </div>
            ) : (
              <div className="notice notice-err" role="alert"><strong>The verifier accepted the edited token.</strong> This is not expected.</div>
            )}
            <div className="verdicts">
              <div className={`verdict ${forge.real.valid ? "is-ok" : "is-bad"}`}>
                {forge.real.valid ? <CircleCheck size={20} aria-hidden /> : <CircleX size={20} aria-hidden />}
                <div>
                  <strong>Your real token</strong>
                  <span className="s">{forge.real.valid ? <>Accepted · groups: {forge.real.groups?.length ? forge.real.groups.join(", ") : "none"}</> : <>Not valid ({forge.real.reason})</>}</span>
                </div>
              </div>
              <div className={`verdict ${forge.fake.valid ? "is-ok" : "is-bad"}`}>
                {forge.fake.valid ? <CircleCheck size={20} aria-hidden /> : <CircleX size={20} aria-hidden />}
                <div>
                  <strong>Forged token</strong>
                  <span className="s">{forge.fake.valid ? "Accepted" : "Rejected"} · group <code>{forge.group}</code> added, old signature kept</span>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}
