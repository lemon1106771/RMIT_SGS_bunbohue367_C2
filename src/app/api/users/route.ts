import { withAuth } from "@/lib/auth/middleware";
import { readDb } from "@/lib/server/db";

// GET /api/users — registered users (username + public tideuserkey). Public identifiers only.
export const GET = withAuth(async () => {
  const { users } = readDb();
  return Response.json({ users: users.map(({ username, tideuserkey, registeredAt, isAdmin }) => ({ username, tideuserkey, registeredAt, isAdmin: !!isAdmin })) });
});
