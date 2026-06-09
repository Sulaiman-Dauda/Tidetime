import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, type MembershipRole } from "@/db/schema";

/** Resolve a user's role on a team, or null if they're not a member. */
export async function teamRole(userId: number, teamId: number): Promise<MembershipRole | null> {
  const [m] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.teamId, teamId)))
    .limit(1);
  return m?.role ?? null;
}
