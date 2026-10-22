"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleCheck, ClipboardList, Hourglass, LoaderCircle, Lock, LockOpen, RefreshCw, Eye, EyeOff } from "lucide-react";
import { KindIcon } from "@/components/KindIcon";
import { RequireLogin } from "@/components/Gate";
import { PageHeader } from "@/components/PageHeader";
import { ErrorBox } from "@/components/ErrorBox";
import { SecretView } from "@/components/SecretView";
import { StatusChip } from "@/components/StatusChip";
import { useApi } from "@/lib/client/api";
import { useIdentity } from "@/lib/client/identity";
import { decryptForRecord, encryptForRecord } from "@/lib/tide/relationship";
import { ENTRY_KINDS, KIND_LABEL, PROVINCES, fmtVnd, payoutGroupNameFor, type EntryKind } from "@/lib/cases";
import { fmtDate, type CaseDto, type EntryDto, type PolicyDto } from "@/lib/client/types";

export default function VolunteerPage() {
  return (
    <RequireLogin title="Volunteer">
      <Volunteer />
    </RequireLogin>
  );
}

/** "Quang Ngai" -> "qn" ; used only to suggest a case id. */
function provinceCode(p: string) {
  const plain = p.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0111/gi, "d").toLowerCase();
  return plain.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").replace(/[^a-z0-9]/g, "") || "hs";
}
const suggestId = (province: string) => `${provinceCode(province)}-${String(Math.floor(1000 + Math.random() * 9000))}`;
const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

function Volunteer() {
  const api = useApi();
  const { username } = useIdentity();

  const [cases, setCases] = useState<CaseDto[]>([]);
  const [casesLoaded, setCasesLoaded] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [sel, setSel] = useState("");

  // new case form (plaintext metadata only)
  const [province, setProvince] = useState(PROVINCES[0]);
  const [caseId, setCaseId] = useState("");
  const [size, setSize] = useState("4");
  const [amount, setAmount] = useState("5000000");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<unknown>(null);

  const loadCases = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await api<{ cases: CaseDto[] }>("/api/cases");
      setCases(r.cases);
    } catch (e) {
      setLoadError(e);
    } finally {
      setCasesLoaded(true);
    }
  }, [api]);

  useEffect(() => { loadCases(); }, [loadCases]);
  useEffect(() => { setCaseId(suggestId(province)); }, [province]);

  const mine = cases.filter((c) => c.volunteer === username);
  const current = mine.find((c) => c.caseId === sel) ?? null;

  async function createCase(ev: React.FormEvent) {
    ev.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const id = caseId.trim().toLowerCase();
      await api("/api/cases", { method: "POST", body: { caseId: id, province, householdSize: Number(size), amountVnd: Number(amount) } });
      await loadCases();
      setSel(id);
      setCaseId(suggestId(province));
    } catch (e) {
      setCreateError(e);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <PageHeader title="Volunteer" purpose="Open a case for each household, then seal their sensitive details. Everything is encrypted on this device before it is sent, so the server only ever holds ciphertext." signedIn />

      <ErrorBox error={loadError} title="Could not load cases" />

      <section className="card" aria-labelledby="new-h">
        <div className="card-head">
          <div>
            <h2 id="new-h">Open a case</h2>
            <p className="card-sub">Only non-sensitive details go here: province, household size and requested amount. They appear on the public ledger.</p>
          </div>
        </div>
        <form onSubmit={createCase} className="stack">
          <div className="formgrid">
            <div>
              <label htmlFor="prov">Province</label>
              <select id="prov" value={province} onChange={(e) => setProvince(e.target.value)}>
                {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="cid">Case id</label>
              <input id="cid" value={caseId} onChange={(e) => setCaseId(e.target.value.toLowerCase())} pattern="[a-z0-9][a-z0-9\-]{1,30}" maxLength={31} required />
            </div>
            <div>
              <label htmlFor="size">Household size</label>
              <input id="size" type="number" min={1} max={50} value={size} onChange={(e) => setSize(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="amt">Requested amount (VND)</label>
              <input id="amt" type="number" min={1000} step={100000} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
          </div>
          <div className="row">
            <button className="btn btn-primary" disabled={creating || !caseId}>{creating ? <><LoaderCircle className="spin" size={18} aria-hidden /> Creating…</> : "Create case"}</button>
            <span className="muted small">Requested: {Number(amount) ? fmtVnd(Number(amount)) : "—"}</span>
          </div>
        </form>
        <ErrorBox error={createError} title="Could not create the case" />
      </section>

      <section aria-labelledby="mine-h" style={{ marginBottom: 24 }}>
        <h2 id="mine-h" className="list-title">My cases ({mine.length})</h2>
        {!casesLoaded ? <div className="skel" role="status" aria-busy="true" aria-label="Loading cases"><i /><i /><i /></div> : null}
        {casesLoaded && !mine.length ? (
          <div className="card empty" role="status">
            <ClipboardList size={22} aria-hidden />
            <p><strong>You have not opened a case yet.</strong> Create the first one above. You add and seal the sensitive details afterwards.</p>
          </div>
        ) : null}
        <div className="grid">
          {mine.map((c) => (
            <button key={c.caseId} className={`casebtn ${c.caseId === sel ? "on" : ""}`} onClick={() => setSel(c.caseId)} aria-pressed={c.caseId === sel}>
              <span className="row between"><strong><code className="id">{c.caseId}</code></strong><StatusChip status={c.status} /></span>
              <span className="small muted">{c.province} · {people(c.householdSize)} · {fmtVnd(c.amountVnd)}</span>
              <span className="small muted">{c.itemCount} encrypted {c.itemCount === 1 ? "item" : "items"} · {fmtDate(c.createdAt)}</span>
            </button>
          ))}
        </div>
      </section>

      {current ? <CaseWork key={current.caseId} c={current} onChanged={loadCases} /> : mine.length ? <p className="muted">Choose a case to add items.</p> : null}
    </>
  );
}

function CaseWork({ c, onChanged }: { c: CaseDto; onChanged: () => void }) {
  const api = useApi();
  const recordId = c.recordId;

  const [policy, setPolicy] = useState<PolicyDto | null>(null);
  const [entries, setEntries] = useState<EntryDto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);

  const [kind, setKind] = useState<EntryKind>("identity");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  const [plain, setPlain] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewError, setViewError] = useState<{ id: string; error: unknown } | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [p, e] = await Promise.all([
        api<{ policies: PolicyDto[] }>(`/api/policies?record=${encodeURIComponent(recordId)}`),
        api<{ entries: EntryDto[] }>(`/api/entries?record=${encodeURIComponent(recordId)}`),
      ]);
      // Policy A: the User policy that lets this volunteer write (and re-read) the case.
      setPolicy(p.policies.find((x) => x.subjectType === "User" && x.access === "read-write") ?? null);
      setEntries(e.entries);
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoaded(true);
    }
  }, [api, recordId]);

  useEffect(() => { load(); }, [load]);

  async function add(ev: React.FormEvent) {
    ev.preventDefault();
    if (!policy) return;
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      const ciphertext = await encryptForRecord(secret, recordId, policy.policyB64);
      // The title is only the kind label: nothing personal ever goes in plaintext.
      await api("/api/entries", { method: "POST", body: { recordId, title: KIND_LABEL[kind].label, kind, ciphertext } });
      setSecret("");
      setSaved(true);
      await load();
      onChanged();
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  async function view(entry: EntryDto) {
    if (!policy) return;
    setViewError(null);
    setBusyId(entry.id);
    try {
      const text = await decryptForRecord(entry.ciphertext, recordId, policy.policyB64);
      setPlain((m) => ({ ...m, [entry.id]: text }));
    } catch (err) {
      setViewError({ id: entry.id, error: err });
    } finally {
      setBusyId(null);
    }
  }

  const hide = (id: string) => setPlain((m) => { const n = { ...m }; delete n[id]; return n; });

  return (
    <>
      <div className="card-head case-title">
        <div>
          <h2>Case <code className="id">{c.caseId}</code></h2>
          <p className="card-sub">{c.province} · {people(c.householdSize)} · requested {fmtVnd(c.amountVnd)} · record <code>{recordId}</code></p>
        </div>
        <StatusChip status={c.status} />
      </div>

      <ErrorBox error={loadError} title="Could not load the case" />

      {loaded && !loadError && !policy ? (
        <div className="waiting" role="status">
          <Hourglass className="big" size={32} aria-hidden />
          <h2>Waiting for the council to set up the case</h2>
          <p>A council member needs to open the Council page, choose case <strong>{c.caseId}</strong> and click Set up case.
            After that you can encrypt and store this household&apos;s details here.</p>
          <button className="btn btn-ghost" onClick={() => { setLoaded(false); load(); }}><RefreshCw size={16} aria-hidden /> Check again</button>
        </div>
      ) : null}

      {policy ? (
        <section className="card" aria-labelledby="add-h">
          <div className="card-head">
            <div>
              <h2 id="add-h">Add an encrypted item</h2>
              <p className="card-sub">The text is encrypted in this browser. Only people the council authorises can ever read it.</p>
            </div>
          </div>
          <form onSubmit={add} className="stack">
            <div>
              <label htmlFor="kind">Kind</label>
              <select id="kind" value={kind} onChange={(e) => setKind(e.target.value as EntryKind)}>
                {ENTRY_KINDS.map((k) => (
                  <option key={k} value={k}>{KIND_LABEL[k].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="secret">Details</label>
              <textarea id="secret" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={KIND_LABEL[kind].hint} required />
            </div>
            <div className="row">
              <button className="btn btn-primary" disabled={saving || !secret.trim()}>
                {saving ? <><LoaderCircle className="spin" size={18} aria-hidden /> Encrypting…</> : <><Lock size={18} aria-hidden /> Encrypt and send</>}
              </button>
              {saved ? <span className="donate-ok" role="status"><CircleCheck size={18} aria-hidden /> Encrypted and saved.</span> : null}
            </div>
          </form>
          <ErrorBox error={saveError} title="Could not save the item" />
        </section>
      ) : null}

      <section aria-labelledby="list-h">
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2 id="list-h" className="list-title" style={{ margin: 0 }}>Encrypted items ({entries.length})</h2>
          <button className="btn btn-ghost btn-sm" aria-pressed={showRaw} onClick={() => setShowRaw((s) => !s)}>
            {showRaw ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />} {showRaw ? "Hide server view" : "What does the server store?"}
          </button>
        </div>
        {showRaw ? (
          <div className="notice notice-info">
            This is exactly what the server holds for each item: the kind label and the <strong>ciphertext</strong>. No key lives there, so even the fund owner cannot read it.
          </div>
        ) : null}
        {loaded && !entries.length && !loadError ? (
          <div className="card empty" role="status">
            <Lock size={22} aria-hidden />
            <p><strong>Nothing stored yet.</strong> Add the first encrypted item above.</p>
          </div>
        ) : null}
        <div className="stack">
          {entries.map((e) => {
            const k = KIND_LABEL[e.kind as EntryKind];
            const text = plain[e.id];
            return (
              <div key={e.id} className="entry">
                <div className="entry-head">
                  <span className="icon"><KindIcon kind={e.kind} /></span>
                  <div>
                    <strong>{k ? k.label : e.title}</strong>
                    <small>{fmtDate(e.createdAt)}</small>
                  </div>
                  <span className="lockmark" aria-hidden>{text !== undefined ? <LockOpen size={18} /> : <Lock size={18} />}</span>
                </div>
                {text !== undefined ? (
                  <>
                    <SecretView kind={e.kind} text={text} />
                    <div><button className="btn btn-ghost btn-sm" onClick={() => hide(e.id)}><EyeOff size={15} aria-hidden /> Hide</button></div>
                  </>
                ) : (
                  <div>
                    <button className="btn btn-ghost btn-sm" disabled={!policy || busyId === e.id} onClick={() => view(e)}>
                      {busyId === e.id ? <><LoaderCircle className="spin" size={15} aria-hidden /> Decrypting…</> : <><LockOpen size={15} aria-hidden /> Decrypt to re-read</>}
                    </button>
                  </div>
                )}
                {viewError?.id === e.id ? <ErrorBox error={viewError.error} title="Could not decrypt" /> : null}
                {showRaw ? <pre className="mono cipher">{e.ciphertext}</pre> : null}
              </div>
            );
          })}
        </div>
      </section>

      <p className="muted small" style={{ marginTop: 24 }}>
        After the council approves, the hospital (a member of group <code>{payoutGroupNameFor(c.caseId)}</code>) can open this sealed file. You have nothing more to do.
      </p>
    </>
  );
}
