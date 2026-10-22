"use client";

import Link from "next/link";
import { ArrowRight, BookOpenCheck, CircleCheck, FileText, Landmark, LoaderCircle, Lock, LogIn, ShieldCheck, Stamp } from "lucide-react";
import { useTideCloak } from "@tidecloak/nextjs";
import { useIdentity } from "@/lib/client/identity";
import { useRegistration } from "@/components/Shell";
import { LeafMark } from "@/components/Leaf";
import { QuorumSeals, Seal, type SealSeat } from "@/components/Seal";

const ROLES = [
  { href: "/volunteer", name: "Volunteer", text: "Visits Ms. Lan at home, enters her file on a phone, and seals her documents and medical records on the spot, before anything is sent." },
  { href: "/council", name: "Council", text: "Fund lead, Local Red Cross and a donor representative. Two of the three must approve before the hospital can join the payout group." },
  { href: "/hospital", name: "Hospital", text: "The payee. Collects the payout straight from the fund. The mock bank only trusts a token signed by the Tide network, and refuses without 2 of 3 approvals." },
  { href: "/operator", name: "Fund owner", text: "Checks fund progress without a family's private file. Even the fund owner cannot approve a payout alone." },
  { href: "/public", name: "Public ledger", text: "No sign-in. Donate (mock), read the payout ledger and see who approved. No personal data is ever published." },
];

const FLOW = [
  { Icon: Lock, title: "Seal", text: "A volunteer encrypts Ms. Lan's file at her home. The server only ever holds ciphertext." },
  { Icon: FileText, title: "Propose payout", text: "The fund proposes paying 50,000,000 VND (mock) straight to Hoa Binh Hospital (mock)." },
  { Icon: Stamp, title: "2 of 3 seals", text: "Two of three council members approve in TideCloak. Each approval is one seal.", seal: true },
  { Icon: Landmark, title: "Bank pays the hospital", text: "The hospital's Tide token now carries the payout group, so the mock bank releases the money." },
  { Icon: BookOpenCheck, title: "Public ledger", text: "Donors see the amount, the transaction reference and who approved. Never the recipient." },
];

// An illustration, not data: two seals on a sample file make the "2 of 3" rule visible at a glance.
const SAMPLE_SEATS: SealSeat[] = [
  { role: "Fund lead", name: "", approved: true, mark: "F" },
  { role: "Local Red Cross", name: "", approved: true, mark: "R" },
  { role: "Donor representative", name: "", approved: false, mark: "D" },
];

export default function HomePage() {
  const { authenticated, isInitializing, initError, login } = useTideCloak();
  const { username, realmRoles, groups, isAdmin } = useIdentity();
  const reg = useRegistration();
  const shownRoles = realmRoles.filter((r) => !r.startsWith("default-roles-") && r !== "offline_access" && r !== "uma_authorization");

  return (
    <>
      <section className="hero" aria-labelledby="hero-h">
        <div>
          <h1 id="hero-h">Charity without trusting a hero.</h1>
          <p className="hero-line">No single person can pay out the money or read a recipient&apos;s file. A payout needs 2 of 3 council seals, enforced by TideCloak.</p>
          <p className="lead">Transparency, privacy, control — today you only get two of the three. WholeLeaf gives you all three.</p>
          <div className="row actions">
            {isInitializing ? (
              <span className="loading" role="status"><LoaderCircle className="spin" size={18} aria-hidden /> Connecting…</span>
            ) : authenticated ? (
              <>
                <Link href="/demo" className="btn btn-primary btn-big">Try the payout story <ArrowRight size={18} aria-hidden /></Link>
                <Link href="/public" className="btn btn-ghost btn-big">View the public ledger</Link>
              </>
            ) : (
              <>
                <Link href="/demo" className="btn btn-primary btn-big">Try the payout story <ArrowRight size={18} aria-hidden /></Link>
                <Link href="/public" className="btn btn-ghost btn-big">View the public ledger</Link>
                <button className="btn btn-ghost btn-big" onClick={() => login()}><LogIn size={18} aria-hidden /> Sign in with Tide</button>
              </>
            )}
          </div>
          <p className="proverb">
            <span className="brand-mark"><LeafMark size={20} /></span>
            <span>Named after a Vietnamese proverb: the whole leaf shelters the torn one.</span>
          </p>
        </div>

        <figure className="casedoc" aria-label="Illustration: a case file with two of three seals">
          <div className="casedoc-head"><strong>Case <code className="id">qb-2041</code></strong><span>Illustration</span></div>
          <dl className="kv">
            <dt>Recipient</dt><dd><span className="redact redact-l" role="img" aria-label="hidden to protect the recipient" /></dd>
            <dt>National ID</dt><dd><span className="redact redact-m" role="img" aria-label="hidden to protect the recipient" /></dd>
            <dt>Medical file</dt><dd><span className="redact redact-l" role="img" aria-label="hidden to protect the recipient" /></dd>
            <dt>Amount</dt><dd>50,000,000 VND</dd>
            <dt>Pay to</dt><dd>Hoa Binh Hospital (mock)</dd>
          </dl>
          <QuorumSeals seats={SAMPLE_SEATS} size={92} />
          <figcaption>Black bars are private details that only the authorised can open. The amount and the seals are visible to everyone.</figcaption>
        </figure>
      </section>

      {initError ? (
        <div className="notice notice-err notice-sm" role="alert">
          <p><strong>Sign-in is unavailable: cannot reach TideCloak.</strong> Check that it is running (http://localhost:8080) and that data/tidecloak.json is exported, then reload.</p>
        </div>
      ) : null}

      <section className="split" aria-label="Why WholeLeaf exists">
        <div>
          <h3>Publish everything</h3>
          <p>Statements list names, national IDs and medical records. Recipients are exposed, targeted by scammers and stared at.</p>
        </div>
        <div>
          <h3>Hide everything</h3>
          <p>Nobody can check that the money arrived. Donors lose trust, and everything depends on one treasurer.</p>
        </div>
      </section>

      <section className="section" aria-labelledby="how-h">
        <h2 id="how-h" style={{ fontSize: "1.5rem" }}>How one payout moves</h2>
        <ol className="flow">
          {FLOW.map((s) => (
            <li key={s.title}>
              <span className={`node ${s.seal ? "is-seal" : ""}`} aria-hidden>
                {s.seal ? <Seal mark="2/3" size={56} rot={-8} /> : <s.Icon size={22} />}
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="roles-h">
        <h2 id="roles-h" style={{ fontSize: "1.5rem" }}>Who does what</h2>
        <ul className="roles">
          {ROLES.map((r) => (
            <li key={r.href}>
              <Link href={r.href}>
                <span className="name">{r.name}</span>
                <span className="what">{r.text}</span>
                <ArrowRight className="go" size={20} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {authenticated ? (
        <section className="idbox" aria-label="Signed-in account">
          <h2>Welcome, {username || "friend"}</h2>
          <p className="muted small" style={{ marginBottom: 0 }}>Read from your sign-in token.</p>
          <dl>
            <dt>Username</dt>
            <dd>{username || "—"}</dd>
            <dt>Realm roles</dt>
            <dd>
              <div className="chips">
                {shownRoles.length ? shownRoles.map((r) => <span key={r} className="chip">{r}</span>) : <span className="muted">none</span>}
                {isAdmin ? <span className="chip chip-clay"><ShieldCheck size={14} aria-hidden /> tide-realm-admin (council)</span> : null}
              </div>
            </dd>
            <dt>Groups</dt>
            <dd>
              <div className="chips">
                {groups.length ? groups.map((g) => <span key={g} className="chip chip-teal">{g}</span>) : <span className="muted">not in any group</span>}
              </div>
            </dd>
          </dl>
          {reg.status === "working" ? <p className="muted small" style={{ marginTop: 12 }}><LoaderCircle className="spin" size={14} aria-hidden /> Registering your account…</p> : null}
          {reg.status === "ok" ? <p className="donate-ok small" style={{ marginTop: 12 }}><CircleCheck size={16} aria-hidden /> Account registered (once) so the council can set up cases for you.</p> : null}
          {reg.status === "error" ? (
            <div className="notice notice-err" role="alert">
              <strong>Could not register your account.</strong>
              <p>{reg.error}</p>
              <p className="small">Reload the page to try again. If it keeps failing, tell a council member.</p>
            </div>
          ) : null}
        </section>
      ) : null}

    </>
  );
}
