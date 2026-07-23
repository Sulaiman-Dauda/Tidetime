import "server-only";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { can, canAny, type Permission } from "@/lib/rbac";
import type { MembershipRole } from "@/db/schema";

/** Resolve the current user and their first accepted company membership. */
export async function getCurrentAuthorization() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [member] = await db
    .select({ role: memberships.role, teamId: memberships.teamId })
    .from(memberships)
    .where(and(eq(memberships.userId, user.id), eq(memberships.accepted, true)))
    .orderBy(asc(memberships.id))
    .limit(1);

  return {
    user,
    role: member?.role ?? null,
    teamId: member?.teamId ?? null,
  };
}

/** Check a user's accepted membership without relying on the current session. */
export async function userHasPermission(userId: number, permission: Permission) {
  const [member] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.accepted, true)))
    .orderBy(asc(memberships.id))
    .limit(1);

  return member ? can(member.role, permission) : false;
}

/**
 * Require a specific permission for the current user.
 * Redirects to /dashboard if they don't have it.
 */
export async function requirePermission(permission: Permission) {
  const authorization = await getCurrentAuthorization();
  if (!authorization) redirect("/login");
  if (!authorization.role || !can(authorization.role, permission)) redirect("/dashboard");

  return {
    user: authorization.user,
    role: authorization.role as MembershipRole,
    teamId: authorization.teamId as number,
  };
}

/** Require at least one permission for the user's accepted company membership. */
export async function requireAnyPermission(permissions: Permission[]) {
  const authorization = await getCurrentAuthorization();
  if (!authorization) redirect("/login");
  if (!authorization.role || !canAny(authorization.role, permissions)) redirect("/dashboard");

  return {
    user: authorization.user,
    role: authorization.role as MembershipRole,
    teamId: authorization.teamId as number,
  };
}
