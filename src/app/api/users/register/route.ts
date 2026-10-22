import { withAuth } from "@/lib/auth/middleware";
import { updateDb, pushAudit } from "@/lib/server/db";
import { usernameOf, tideUserKeyOf, isRealmAdmin } from "@/lib/server/claims";

// POST /api/users/register — record the caller's username + tideuserkey, taken ONLY from the
// verified token, so the council can later sign a `User` policy naming this person's key.
export const POST = withAuth(async (_req, jwt) => {
  const username = usernameOf(jwt);
  const tideuserkey = tideUserKeyOf(jwt);
  const sub = jwt.sub ?? "";
  if (!username || !tideuserkey) {
    return Response.json(
      { error: "Token has no preferred_username or tideuserkey claim (check the Tide User Key mapper)." },
      { status: 400 }
    );
  }
  const user = updateDb((db) => {
    const existing = db.users.find((u) => u.sub === sub || u.username === username);
    const isAdmin = isRealmAdmin(jwt);
    if (existing) {
      existing.isAdmin = isAdmin;
      existing.username = username;
      existing.tideuserkey = tideuserkey;
      existing.sub = sub;
      return existing;
    }
    const row = { username, tideuserkey, sub, registeredAt: new Date().toISOString(), isAdmin };
    db.users.push(row);
    pushAudit(db, username, "user.registered", "", isAdmin ? "council (tide-realm-admin)" : "");
    return row;
  });
  return Response.json({ user });
});
