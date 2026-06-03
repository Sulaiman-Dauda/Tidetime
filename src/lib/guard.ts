import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { can, type Permission } from "@/lib/rbac";
import type { MembershipRole } from "@/db/schema";

/**
 * Require a specific permission for the current user.
 * Redirects to /dashboard if they don't have it.
 */
export async function requirePermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [member] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .limit(1);

  const role: MembershipRole = member?.role ?? "member";

  if (!can(role, permission)) {
    redirect("/dashboard");
  }

  return { user, role };
}
