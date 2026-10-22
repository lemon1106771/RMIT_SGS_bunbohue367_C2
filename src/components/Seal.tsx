"use client";
import { useId } from "react";
import { Lock, LockOpen } from "lucide-react";
import { COUNCIL_ROLES, QUORUM } from "@/lib/cases";
import type { CaseDto } from "@/lib/client/types";

const ROT = [-7, 5, -3];

/**
 * A round red ink seal: "APPROVED" around the top, the member's mark in the middle. It stamps in once (180ms).
 * Small seals (tables) drop the arc text and keep the mark, so nothing is ever set at an unreadable size.
 */
export function Seal({ mark, label, size = 96, rot = -6 }: { mark: string; label?: string; size?: number; rot?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const compact = size < 64;
  const long = mark.length > 1;
  return (
    <svg
      className="seal"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={`Approved seal${label ? `: ${label}` : ""}`}
      style={{ ["--rot" as string]: `${rot}deg` }}
    >
      <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth={compact ? 4 : 3} />
      <circle cx="50" cy="50" r={compact ? 38 : 40} fill="none" stroke="currentColor" strokeWidth={compact ? 2.2 : 1.4} />
      {compact ? (
        <text x="50" y="66" textAnchor="middle" fontFamily="var(--serif)" fontWeight="700" fontSize={long ? 30 : 46} fill="currentColor">{mark}</text>
      ) : (
        <>
          <defs>
            <path id={`arc${uid}`} d="M 21 50 A 29 29 0 0 1 79 50" />
          </defs>
          <text fontFamily="var(--sans)" fontWeight="700" fontSize="12.5" letterSpacing="1.1" fill="currentColor">
            <textPath href={`#arc${uid}`} startOffset="50%" textAnchor="middle">APPROVED</textPath>
          </text>
          <text x="50" y={long ? 66 : 70} textAnchor="middle" fontFamily="var(--serif)" fontWeight="700" fontSize={long ? 26 : 36} fill="currentColor">{mark}</text>
          <path d="M31 77h38" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/** The seat still waiting for a seal. */
export function SealSlot({ size = 96 }: { size?: number }) {
  return <span className="seal-slot" style={{ width: size, height: size }} aria-hidden>Pending</span>;
}

export interface SealSeat { role: string; name: string; approved: boolean; mark: string }

export function seatsFromCase(c: CaseDto): SealSeat[] {
  const approved = new Set(c.approvals.map((a) => a.actor));
  return COUNCIL_ROLES.map((r, i) => {
    const m = c.council[i] ?? "";
    return { role: r.title, name: m, approved: !!m && approved.has(m), mark: (m || r.title).trim().charAt(0).toUpperCase() };
  });
}

/** Three seats, one seal per approval. One seal: still locked. Two: unlocked. */
export function QuorumSeals({ seats, size = 96 }: { seats: SealSeat[]; size?: number }) {
  const count = seats.filter((s) => s.approved).length;
  const open = count >= QUORUM;
  return (
    <div className="quorum" style={{ ["--seal-size" as string]: `${size}px` }}>
      <ul className="seats" aria-label="Council seals">
        {seats.map((s, i) => (
          <li key={i} className={`seat ${s.approved ? "is-in" : ""}`}>
            <span className="stage">{s.approved ? <Seal mark={s.mark} label={s.name || s.role} size={size} rot={ROT[i % ROT.length]} /> : <SealSlot size={size} />}</span>
            <span className="seat-role">{s.role}</span>
            {s.name ? <span className="seat-name">{s.name}</span> : null}
            <span className="seat-state">{s.approved ? "Approved" : "Pending"}</span>
          </li>
        ))}
      </ul>
      <p className={`lockline ${open ? "is-open" : "is-locked"}`} role="status">
        {open ? <LockOpen size={18} aria-hidden /> : <Lock size={18} aria-hidden />}
        <span>
          <strong>{count} of {seats.length} seals.</strong>{" "}
          {open ? `Quorum of ${QUORUM} reached: the payout is unlocked.` : `Still locked: ${QUORUM - count} more ${QUORUM - count === 1 ? "seal" : "seals"} needed.`}
        </span>
      </p>
    </div>
  );
}
