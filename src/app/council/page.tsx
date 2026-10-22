"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, CircleCheck, CircleX, Circle, ClipboardList, FileText, Hourglass, LoaderCircle } from "lucide-react";
import { useTideCloak } from "@tidecloak/nextjs";
import { RequireLogin } from "@/components/Gate";
import { PageHeader } from "@/components/PageHeader";
import { ErrorBox } from "@/components/ErrorBox";
import { AuditTimeline } from "@/components/AuditTimeline";
import { StatusChip } from "@/components/StatusChip";
import { TrusteeStatus } from "@/components/TrusteeStatus";
import { useApi } from "@/lib/client/api";
import { useAdminLinks, useIdentity } from "@/lib/client/identity";
import { signRelationshipPolicy, describeRelationshipPolicy, type RelationshipGrant } from "@/lib/tide/relationship";
import { BRAND, QUORUM, fmtVnd, payoutGroupFor, payoutGroupNameFor } from "@/lib/cases";
import type { CaseDto, UserDto } from "@/lib/client/types";

type StepState = { status: "idle" | "working" | "ok" | "error"; error?: unknown };

const PURPOSE = "Propose a payout and watch the seals come in. The hospital can collect only after 2 of 3 council members approve.";

export default function CouncilPage() {
  return (
    <RequireLogin title="Council">
      <CouncilGate />
    </RequireLogin>
  );
}

function CouncilGate() {
  const { isAdmin, username } = useIdentity();
  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Council" purpose={PURPOSE} signedIn />
        <div className="notice notice-lock" role="status">
          <strong>This page is for the three council members.</strong>
          <p>Account <strong>{username}</strong> does not have the <code>tide-realm-admin</code> role, so it cannot propose or approve payouts.
            The council is the fund lead, the local Red Cross and a donor representative: the three admins of the TideCloak realm.</p>
          <p>If you are a council member, ask a TideCloak realm admin to grant you the role, then sign in again. Volunteers and hospitals do not need this page.</p>
        </div>
      </>
    );
  }
  return <CouncilDesk />;
}

function b64ToBytes(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

function CouncilDesk() {
  const api = useApi();
  const { getVendorId } = useTideCloak();
  const links = useAdminLinks();

  const [users, setUsers] = useState<UserDto[]>([]);
  const [cases, setCases] = useState<CaseDto[]>([]);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [sel, setSel] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // proposal
  const [amount, setAmount] = useState("");
  const [payee, setPayee] = useState("");
  const [payeeName, setPayeeName] = useState(BRAND.payeeDefault);
  const [proposing, setProposing] = useState(false);
  const [proposeError, setProposeError] = useState<unknown>(null);

  // extension: sealed-file policies
  const [adminPolicyError, setAdminPolicyError] = useState<unknown>(null);
  const adminPolicy = useRef<Uint8Array | null>(null);
  const [adminReady, setAdminReady] = useState(false);
  const [stepA, setStepA] = useState<StepState>({ status: "idle" });
  const [stepB, setStepB] = useState<StepState>({ status: "idle" });
  const [formError, setFormError] = useState("");
  const done = useRef({ A: false, B: false });

  const loadLists = useCallback(async () => {
    try {
      const [u, c] = await Promise.all([api<{ users: UserDto[] }>("/api/users"), api<{ cases: CaseDto[] }>("/api/cases")]);
      setUsers(u.users);
      setCases(c.cases);
      setLoadError(null);
    } catch (e) {
      setLoadError(e);
    }
  }, [api]);

  useEffect(() => { loadLists(); }, [loadLists]);

  // Fetch the realm admin policy BEFORE any click, so the click handler can open the Tide popup immediately.
  useEffect(() => {
    api<{ policy: string }>("/api/admin-policy")
      .then((r) => { adminPolicy.current = b64ToBytes(r.policy); setAdminReady(true); })
      .catch((e) => setAdminPolicyError(e));
  }, [api]);

  const c = cases.find((x) => x.caseId === sel) ?? null;
  const volunteerRow = c ? users.find((u) => u.username === c.volunteer) : undefined;

  function pick(id: string) {
    setSel(id);
    setStepA({ status: "idle" });
    setStepB({ status: "idle" });
    setFormError("");
    setProposeError(null);
    const k = cases.find((x) => x.caseId === id);
    setAmount(String(k?.proposal?.amountVnd ?? k?.amountVnd ?? ""));
    setPayee(k?.proposal?.payee ?? "");
    setPayeeName(k?.proposal?.payeeName ?? BRAND.payeeDefault);
  }

  async function propose(ev: React.FormEvent) {
    ev.preventDefault();
    if (!c) return;
    setProposing(true);
    setProposeError(null);
    try {
      await api(`/api/cases/${encodeURIComponent(c.caseId)}/propose`, { method: "POST", body: { amount: Number(amount), payee: payee.trim(), payeeName: payeeName.trim() } });
      await loadLists();
      setReloadKey((k) => k + 1);
    } catch (e) {
      setProposeError(e);
    } finally {
      setProposing(false);
    }
  }

  function validate(): string {
    if (!c) return "Choose a case first.";
    if (!volunteerRow?.tideuserkey) return `Volunteer ${c.volunteer} has no tideuserkey yet: they need to sign in once.`;
    if (!adminPolicy.current) return "The realm admin policy is not loaded yet.";
    return "";
  }

  function grantFor(step: "A" | "B"): RelationshipGrant {
    const vendorId = (() => { try { return getVendorId(); } catch { return ""; } })() || links.vendorId;
    return step === "A"
      ? { vendorId, subject: { type: "User", id: volunteerRow!.tideuserkey }, recordId: c!.recordId, access: "read-write" }
      : { vendorId, subject: { type: "Group", id: payoutGroupFor(c!.caseId) }, recordId: c!.recordId, access: "read" };
  }

  // The first await inside is the Tide enclave popup, so this must be called straight from a click.
  async function runStep(step: "A" | "B"): Promise<boolean> {
    const set = step === "A" ? setStepA : setStepB;
    set({ status: "working" });
    try {
      const grant = grantFor(step);
      const signed = await signRelationshipPolicy(grant, adminPolicy.current!);
      const d = describeRelationshipPolicy(signed);
      if (!d.signed) throw new Error("The policy came back unsigned.");
      await api("/api/policies", { method: "POST", body: { subject: grant.subject, recordId: c!.recordId, access: grant.access, policy: signed } });
      done.current[step] = true;
      set({ status: "ok" });
      return true;
    } catch (e) {
      done.current[step] = false;
      set({ status: "error", error: e });
      return false;
    }
  }

  async function finish() {
    await loadLists();
    setReloadKey((k) => k + 1);
  }

  async function setupBoth() {
    const v = validate();
    setFormError(v);
    if (v) return;
    done.current = { A: false, B: false };
    const a = await runStep("A"); // popup opens synchronously from the click
    if (a) await runStep("B");
    await finish();
  }

  async function retry(step: "A" | "B") {
    const v = validate();
    setFormError(v);
    if (v) return;
    await runStep(step);
    await finish();
  }

  const busy = stepA.status === "working" || stepB.status === "working";
  const groupName = c ? payoutGroupNameFor(c.caseId) : "payout-case-<case id>";

  return (
    <>
      <PageHeader title="Council" purpose={PURPOSE} signedIn />

      <ErrorBox error={loadError} title="Could not load the lists" />

      <section className="card" aria-labelledby="pick-h">
        <div className="card-head">
          <div>
            <h2 id="pick-h">Choose a case</h2>
            <p className="card-sub">Everything below applies to the case you pick.</p>
          </div>
        </div>
        <select aria-label="Case" value={sel} onChange={(e) => pick(e.target.value)}>
          <option value="">Select a case…</option>
          {cases.map((k) => <option key={k.caseId} value={k.caseId}>{k.caseId} · {k.province} · {fmtVnd(k.amountVnd)}</option>)}
        </select>
        {!cases.length ? <p className="muted small" style={{ marginTop: 12, marginBottom: 0 }}>No cases yet. A volunteer opens them.</p> : null}
        {c ? (
          <div className="casehead" style={{ marginTop: 16 }}>
            <div>
              <strong><code className="id">{c.caseId}</code></strong> <span className="small muted">· {c.province} · {c.householdSize} {c.householdSize === 1 ? "person" : "people"} · requested {fmtVnd(c.amountVnd)}</span>
              <div className="small muted">Volunteer {c.volunteer} · {c.itemCount} sealed {c.itemCount === 1 ? "item" : "items"}</div>
            </div>
            <StatusChip status={c.status} />
          </div>
        ) : null}
      </section>

      {c ? (
        <>
          <section className="card" aria-labelledby="prop-h">
            <div className="card-head">
              <div>
                <h2 id="prop-h">Payout proposal</h2>
                <p className="card-sub">The fund lead pays <strong>straight to the hospital</strong>, never through a person. This only records the proposal: no money moves and nothing unlocks yet.{c.proposal ? " Submitting again replaces the current proposal." : ""}</p>
              </div>
            </div>
            {c.status === "paid" ? (
              <div className="notice notice-ok">This case is already paid out, so it cannot be proposed again.</div>
            ) : (
              <form onSubmit={propose} className="stack">
                <div className="formgrid">
                  <div>
                    <label htmlFor="pamt">Amount (VND)</label>
                    <input id="pamt" type="number" min={1000} step={100000} value={amount} onChange={(e) => setAmount(e.target.value)} required />
                  </div>
                  <div>
                    <label htmlFor="pname">Public payee name</label>
                    <input id="pname" value={payeeName} maxLength={80} onChange={(e) => setPayeeName(e.target.value)} required />
                  </div>
                  <div>
                    <label htmlFor="pacc">Hospital username</label>
                    <input id="pacc" list="userlist" value={payee} autoComplete="off" onChange={(e) => setPayee(e.target.value)} placeholder="e.g. hospital-hoabinh" required />
                  </div>
                </div>
                <datalist id="userlist">{users.map((u) => <option key={u.username} value={u.username} />)}</datalist>
                <div className="row">
                  <button className="btn btn-primary" disabled={proposing || !amount || !payee.trim()}>{proposing ? <><LoaderCircle className="spin" size={18} aria-hidden /> Recording…</> : <><FileText size={18} aria-hidden /> Propose payout</>}</button>
                  {Number(amount) ? <span className="muted small">{fmtVnd(Number(amount))} <ArrowRight size={13} aria-hidden style={{ verticalAlign: "-2px" }} /> {payeeName}</span> : null}
                </div>
              </form>
            )}
            <ErrorBox error={proposeError} title="Could not record the proposal" />
            {c.proposal ? (
              <p className="small" style={{ marginTop: 12, marginBottom: 0 }}><CircleCheck size={16} aria-hidden style={{ verticalAlign: "-3px", color: "var(--leaf)" }} /> Current proposal: <strong>{fmtVnd(c.proposal.amountVnd)}</strong> <ArrowRight size={13} aria-hidden style={{ verticalAlign: "-2px" }} /> <strong>{c.proposal.payeeName}</strong> (account <code>{c.proposal.payee}</code>), proposed by {c.proposal.proposedBy}.</p>
            ) : null}
          </section>

          <section className="card" aria-labelledby="release-h">
            <div className="card-head">
              <div>
                <h2 id="release-h">Approval in TideCloak</h2>
                <p className="card-sub">The binding approval is not a button in this app. It is a group change request in TideCloak that needs {QUORUM} of 3 admins. Once it is committed, the hospital&apos;s Tide token carries group <code>{payoutGroupFor(c.caseId)}</code>, the only thing the mock bank trusts.</p>
              </div>
            </div>
            <ReleaseChecklist caseId={c.caseId} groupName={groupName} payee={c.proposal?.payee ?? payee} groupsUrl={links.groupsUrl} changeUrl={links.changeRequestsUrl} />
            <p className="muted small" style={{ marginBottom: 0 }}>Quorum = floor(admins x 0.7). With 3 council members, {QUORUM} must approve.</p>
          </section>

          <TrusteeStatus c={c} onChanged={() => { loadLists(); setReloadKey((k) => k + 1); }} />

          <section className="card" aria-labelledby="ext-h">
            <details>
              <summary id="ext-h">Optional: sealed-file access rules</summary>
              <p className="muted" style={{ marginTop: 12 }}>The mock bank does not need this. It lets the volunteer encrypt the family&apos;s file, and lets the hospital open that file after joining the group. You sign two policies with Tide: <strong>A</strong> for volunteer <strong>{c.volunteer}</strong> (read and write) and <strong>B</strong> for group <code>{payoutGroupFor(c.caseId)}</code> (read only; the group starts empty).</p>
              <div className="row" style={{ margin: "12px 0" }}>
                <span className={`chip ${c.hasA ? "chip-ok" : ""}`}>{c.hasA ? <Check size={14} aria-hidden /> : <Circle size={14} aria-hidden />} Policy A (volunteer)</span>
                <span className={`chip ${c.hasB ? "chip-ok" : ""}`}>{c.hasB ? <Check size={14} aria-hidden /> : <Circle size={14} aria-hidden />} Policy B (group {payoutGroupFor(c.caseId)})</span>
              </div>
              {adminPolicyError ? <ErrorBox error={adminPolicyError} title="Could not load the admin policy" /> : null}
              {formError ? <div className="notice notice-err" role="alert">{formError}</div> : null}
              <div className="row">
                <button className="btn btn-primary" onClick={setupBoth} disabled={busy || !adminReady}>
                  {busy ? <><LoaderCircle className="spin" size={18} aria-hidden /> Waiting for Tide…</> : c.hasA && c.hasB ? "Sign again and set up case" : "Set up case"}
                </button>
                {!adminReady && !adminPolicyError ? <span className="muted small">Loading the admin policy…</span> : null}
              </div>
              <p className="muted small" style={{ marginTop: 12 }}>Two Tide approvals open in a row (A, then B). If the browser blocks the second popup, click Retry on that step.</p>
              <div>
                <StepRow label={`A · Volunteer ${c.volunteer}, read and write`} state={stepA} onRetry={() => retry("A")} busy={busy} />
                <StepRow label={`B · Payout group ${payoutGroupFor(c.caseId)}, read only`} state={stepB} onRetry={() => retry("B")} busy={busy} />
              </div>
            </details>
          </section>

          <AuditTimeline record={c.recordId} reloadKey={reloadKey} />
        </>
      ) : (
        <div className="card empty" role="status">
          <ClipboardList size={22} aria-hidden />
          <p><strong>No case selected.</strong> Choose a case above to propose a payout, log an approval and see its history.</p>
        </div>
      )}
    </>
  );
}

function StepRow({ label, state, onRetry, busy }: { label: string; state: StepState; onRetry?: () => void; busy: boolean }) {
  const Icon = { idle: Circle, working: Hourglass, ok: CircleCheck, error: CircleX }[state.status];
  return (
    <div>
      <div className="policy-step">
        <span aria-hidden className={`st ${state.status === "ok" ? "ok" : state.status === "error" ? "bad" : ""}`}><Icon size={18} /></span>
        <span className="grow">{label}</span>
        {state.status === "error" && onRetry ? <button className="btn btn-ghost btn-sm" disabled={busy} onClick={onRetry}>Retry</button> : null}
      </div>
      {state.status === "error" ? <ErrorBox error={state.error} /> : null}
    </div>
  );
}

function ReleaseChecklist({ caseId, groupName, payee, groupsUrl, changeUrl }: { caseId: string; groupName: string; payee: string; groupsUrl: string; changeUrl: string }) {
  const key = `wholeleaf-release-${caseId}`;
  const [ticks, setTicks] = useState<boolean[]>([false, false, false]);
  useEffect(() => {
    try { const raw = localStorage.getItem(key); setTicks(raw ? JSON.parse(raw) : [false, false, false]); } catch { setTicks([false, false, false]); }
  }, [key]);
  const toggle = (i: number) => setTicks((t) => {
    const n = t.map((v, j) => (j === i ? !v : v));
    try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* ignore */ }
    return n;
  });
  const items = [
    { t: <>Council member 1 adds account <strong>{payee || "the hospital"}</strong> to group <code>{groupName}</code> in the TideCloak admin console. If the group does not exist yet, first create a top-level group with exactly that name.</>, link: groupsUrl, label: "Open Groups" },
    { t: <>Council member 2 <strong>approves</strong> the change request in the admin console.</>, link: changeUrl, label: "Open Change requests" },
    { t: <>Once the change is <strong>committed</strong>, the hospital signs in again and clicks Collect payout. The token can take up to 2 minutes to update.</>, link: "/hospital", label: "Open Hospital page" },
  ];
  return (
    <ol className="checklist">
      {items.map((it, i) => (
        <li key={i} className={ticks[i] ? "done" : undefined}>
          <span className="num" aria-hidden>{i + 1}</span>
          <div className="body">
            <p>{it.t}</p>
            <a className="btn btn-ghost btn-sm" href={it.link} target={it.link.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{it.label} {it.link.startsWith("http") ? <ArrowUpRight size={15} aria-hidden /> : <ArrowRight size={15} aria-hidden />}</a>
          </div>
          <input type="checkbox" checked={ticks[i]} onChange={() => toggle(i)} aria-label={`Step ${i + 1} done`} />
        </li>
      ))}
    </ol>
  );
}
