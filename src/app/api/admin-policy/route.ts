import { withRole } from "@/lib/auth/middleware";
import { extractToken } from "@/lib/auth/tideJWT";
import { loadTideConfig } from "@/lib/auth/tidecloakConfig";
import { isRealmAdmin } from "@/lib/server/claims";
import { ADMIN_ROLE } from "@/lib/cases";

// GET /api/admin-policy — the realm's admin policy (signed bytes, base64) that authorises a council member
// to sign a relationship policy. Per relationship.ts: fetched ON THE SERVER from
//   GET {auth-server-url}/admin/realms/{realm}/iga/role-policies/name/tide-realm-admin   (field `policy`)
// with the admin's token. Only council members (tide-realm-admin, from the verified token) may call this.
//
// The caller's access token is DPoP-bound. If TideCloak refuses it as a plain Bearer, we fall back
// to a short-lived master-admin token minted from KC_BOOTSTRAP_ADMIN_* in the SERVER env (.env);
// that credential never reaches the browser.
async function fetchAdminPolicy(base: string, realm: string, bearer: string) {
  const url = `${base}/admin/realms/${encodeURIComponent(realm)}/iga/role-policies/name/tide-realm-admin`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${bearer}` }, cache: "no-store" });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

async function masterToken(base: string): Promise<string | null> {
  const user = process.env.KC_BOOTSTRAP_ADMIN_USERNAME || "admin";
  const pass = process.env.KC_BOOTSTRAP_ADMIN_PASSWORD;
  if (!pass) return null;
  const res = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "password", client_id: "admin-cli", username: user, password: pass }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token?: string };
  return j.access_token ?? null;
}

function pickPolicy(text: string): string | null {
  try {
    const j = JSON.parse(text);
    if (typeof j?.policy === "string") return j.policy;
    if (Array.isArray(j) && typeof j[0]?.policy === "string") return j[0].policy;
  } catch {
    /* not JSON */
  }
  return null;
}

export const GET = withRole(ADMIN_ROLE, async (req, jwt) => {
  if (!isRealmAdmin(jwt)) {
    return Response.json({ error: "Forbidden: tide-realm-admin (realm-management) required" }, { status: 403 });
  }
  let config;
  try {
    config = loadTideConfig();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "No adapter config" }, { status: 500 });
  }
  const base = config["auth-server-url"].replace(/\/+$/, "");
  const callerToken = extractToken(req.headers.get("authorization"));

  const first = await fetchAdminPolicy(base, config.realm, callerToken);
  let policy = first.ok ? pickPolicy(first.text) : null;
  let via = "caller-token";
  let lastError = `${first.status} ${first.text.slice(0, 300)}`;

  if (!policy) {
    const mt = await masterToken(base);
    if (mt) {
      const second = await fetchAdminPolicy(base, config.realm, mt);
      policy = second.ok ? pickPolicy(second.text) : null;
      via = "server-admin-token";
      if (!policy) lastError = `${second.status} ${second.text.slice(0, 300)}`;
    }
  }

  if (!policy) {
    return Response.json(
      {
        error:
          "Could not read the realm admin policy from TideCloak. Is tide-realm-admin granted and committed? " +
          "If the caller token is refused, set KC_BOOTSTRAP_ADMIN_PASSWORD in .env and restart `npm run dev`.",
        detail: lastError,
      },
      { status: 503 }
    );
  }
  return Response.json({ policy, via });
});
