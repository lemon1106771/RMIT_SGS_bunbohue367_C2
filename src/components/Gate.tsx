"use client";
import { LoaderCircle, LogIn } from "lucide-react";
import { useTideCloak } from "@tidecloak/nextjs";

/** Renders children only for a signed-in user; otherwise a calm sign-in card. */
export function RequireLogin({ title, children }: { title: string; children: React.ReactNode }) {
  const { authenticated, isInitializing, initError, login } = useTideCloak();
  if (isInitializing) {
    return (
      <div className="card narrow" role="status" aria-busy="true">
        <p className="muted row" style={{ margin: 0 }}><LoaderCircle className="spin" size={18} aria-hidden /> Connecting to TideCloak…</p>
        <div className="skel" aria-hidden><i /><i /><i /></div>
      </div>
    );
  }
  if (initError) {
    return (
      <div className="notice notice-err" role="alert">
        <strong>Cannot reach TideCloak.</strong>
        <p>Check that TideCloak is running and that data/tidecloak.json is exported, then reload this page.</p>
      </div>
    );
  }
  if (!authenticated) {
    return (
      <div className="card narrow">
        <h1 style={{ fontSize: "1.75rem" }}>{title}</h1>
        <p className="muted">Sign in so the fund knows which role you hold. Nothing here is visible without it.</p>
        <button className="btn btn-primary" onClick={() => login()}><LogIn size={18} aria-hidden /> Sign in with Tide</button>
      </div>
    );
  }
  return <>{children}</>;
}
