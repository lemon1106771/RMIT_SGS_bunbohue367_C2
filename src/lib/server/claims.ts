// Read identity facts ONLY from the verified access token (withAuth has already checked signature,
// issuer, azp, expiry and the DPoP binding). Never from the request body.
import type { JWTPayload } from "jose";
import { ADMIN_CLIENT, ADMIN_ROLE } from "@/lib/cases";

export function usernameOf(jwt: JWTPayload): string {
  const u = (jwt as Record<string, unknown>)["preferred_username"];
  return typeof u === "string" ? u : "";
}

export function tideUserKeyOf(jwt: JWTPayload): string {
  const k = (jwt as Record<string, unknown>)["tideuserkey"];
  return typeof k === "string" ? k : "";
}

export function groupsOf(jwt: JWTPayload): string[] {
  const g = (jwt as Record<string, unknown>)["groups"];
  return Array.isArray(g) ? g.map(String) : [];
}

/** tide-realm-admin is a CLIENT role of realm-management. Check exactly that, not any client. */
export function isRealmAdmin(jwt: JWTPayload): boolean {
  const ra = (jwt as Record<string, unknown>)["resource_access"] as
    | Record<string, { roles?: unknown }>
    | undefined;
  const roles = ra?.[ADMIN_CLIENT]?.roles;
  return Array.isArray(roles) && roles.map(String).includes(ADMIN_ROLE);
}
