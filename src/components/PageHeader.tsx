"use client";
import { UserRound } from "lucide-react";
import { useIdentity } from "@/lib/client/identity";

/** One header for every page: title, a one-line purpose and, on signed-in pages, who is signed in. */
export function PageHeader({ title, purpose, signedIn }: { title: string; purpose: string; signedIn?: boolean }) {
  const { username } = useIdentity();
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        <p className="purpose">{purpose}</p>
      </div>
      {signedIn && username ? (
        <span className="who-badge"><UserRound size={16} aria-hidden /> Signed in as <strong>{username}</strong></span>
      ) : null}
    </header>
  );
}
