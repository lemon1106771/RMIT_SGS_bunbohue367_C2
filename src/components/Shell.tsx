"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useTideCloak } from "@tidecloak/nextjs";
import { useApi } from "@/lib/client/api";
import { explainError } from "@/lib/client/errors";
import { LogOut } from "lucide-react";
import { LeafMark } from "@/components/Leaf";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/demo", label: "Try the story" },
  { href: "/volunteer", label: "Volunteer" },
  { href: "/council", label: "Council" },
  { href: "/hospital", label: "Hospital" },
  { href: "/operator", label: "Fund owner" },
  { href: "/public", label: "Public ledger" },
];

export type RegState = { status: "idle" | "working" | "ok" | "error"; error?: string };
const RegCtx = createContext<RegState>({ status: "idle" });
export const useRegistration = () => useContext(RegCtx);

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { authenticated, isInitializing, token, logout } = useTideCloak();
  const api = useApi();
  const [reg, setReg] = useState<RegState>({ status: "idle" });
  const started = useRef(false);
  const navRef = useRef<HTMLElement>(null);

  // On login, record username + tideuserkey once so the council can later name this person in a policy.
  useEffect(() => {
    if (!authenticated || !token || started.current) return;
    started.current = true;
    setReg({ status: "working" });
    api("/api/users/register", { method: "POST", body: {} })
      .then(() => setReg({ status: "ok" }))
      .catch((e) => {
        started.current = false;
        setReg({ status: "error", error: explainError(e).summary });
      });
  }, [authenticated, token, api]);

  useEffect(() => {
    if (!authenticated) started.current = false;
  }, [authenticated]);

  // On a phone the nav scrolls sideways: keep the current page's link in view.
  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>("a.active")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [path]);

  return (
    <RegCtx.Provider value={reg}>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand" aria-label="WholeLeaf home">
            <span className="brand-mark"><LeafMark size={30} /></span>
            <strong>WholeLeaf</strong>
          </Link>
          <nav ref={navRef} className="nav" aria-label="Main">
            {NAV.map((n) => {
              const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="who">
            {isInitializing ? null : authenticated ? (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => logout()}><LogOut size={16} aria-hidden /> Sign out</button>
              </>
            ) : null}
          </div>
        </div>
      </header>
      <main className="container">{children}</main>
      <footer className="footer">
        <div className="footer-inner">
          <span className="brand">
            <span className="brand-mark"><LeafMark size={24} /></span>
            <strong>WholeLeaf</strong>
          </span>
          <p>Charity without trusting a hero.</p>
          <p>Powered by TideCloak · Emergent Authority</p>
        </div>
      </footer>
    </RegCtx.Provider>
  );
}
