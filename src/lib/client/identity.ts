"use client";
import { useTideCloak } from "@tidecloak/nextjs";
import { ADMIN_CLIENT, ADMIN_ROLE } from "@/lib/cases";

export interface Identity {
  username: string;
  realmRoles: string[];
  groups: string[];
  isAdmin: boolean;
}

/** Facts about the signed-in user, read from the token the SDK already holds (UI only, never authorization). */
export function useIdentity(): Identity {
  const { authenticated, getValueFromToken, getValueFromIdToken, hasClientRole } = useTideCloak();
  if (!authenticated) return { username: "", realmRoles: [], groups: [], isAdmin: false };
  const pick = (k: string) => {
    try {
      return getValueFromToken(k) ?? getValueFromIdToken(k);
    } catch {
      return undefined;
    }
  };
  const username = String(pick("preferred_username") ?? "");
  const ra = pick("realm_access") as { roles?: unknown } | undefined;
  const realmRoles = Array.isArray(ra?.roles) ? (ra!.roles as unknown[]).map(String) : [];
  const g = pick("groups");
  const groups = Array.isArray(g) ? g.map(String) : [];
  let isAdmin = false;
  try {
    isAdmin = hasClientRole(ADMIN_ROLE, ADMIN_CLIENT);
  } catch {
    isAdmin = false;
  }
  return { username, realmRoles, groups, isAdmin };
}

/** Realm name + TideCloak base URL for admin-console deep links. */
export function useAdminLinks() {
  const { getConfig } = useTideCloak();
  let realm = "clearaid";
  let base = "http://localhost:8080";
  let vendorId = "";
  try {
    const c = getConfig() ?? {};
    if (typeof c.realm === "string") realm = c.realm;
    if (typeof c["auth-server-url"] === "string") base = c["auth-server-url"].replace(/\/+$/, "");
    if (typeof c.vendorId === "string") vendorId = c.vendorId;
  } catch {
    /* keep defaults */
  }
  // Council members are Tide-linked admins of THIS realm, so they use the realm's own console,
  // not the master console (that one is only for the bootstrap master admin).
  const console_ = `${base}/admin/${realm}/console/#/${realm}`;
  return { realm, vendorId, groupsUrl: `${console_}/groups`, changeRequestsUrl: `${console_}/change-requests` };
}
