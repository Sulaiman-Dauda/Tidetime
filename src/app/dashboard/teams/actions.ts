"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { teams, memberships, users, type MembershipRole } from "@/db/schema";
import { can, canAssignRole } from "@/lib/rbac";
import { teamRole } from "@/server/memberships";
import { parseCsvRecords, validateProviderImport } from "@/lib/csv";

export type TeamState = { ok?: boolean; error?: string } | null;

const schema = z.object({ name: z.string().min(2, "Name is too short").max(128) });

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function createTeamAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const user = await requireUser();
  const parsed = schema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" };

  const base = slugify(parsed.data.name) || "team";
  let slug = base;
  for (let i = 1; ; i++) {
    const [existing] = await db.select({ id: teams.id }).from(teams).where(eq(teams.slug, slug)).limit(1);
    if (!existing) break;
    slug = `${base}-${i}`;
  }

  await db.transaction(async (tx) => {
    const [team] = await tx.insert(teams).values({ name: parsed.data.name, slug }).returning({ id: teams.id });
    await tx.insert(memberships).values({ userId: user.id, teamId: team.id, role: "owner", accepted: true });
  });

  revalidatePath("/dashboard/teams");
  return { ok: true };
}

const roleSchema = z.object({
  teamId: z.coerce.number().int().positive(),
  membershipId: z.coerce.number().int().positive(),
  role: z.enum(["admin", "manager", "provider", "receptionist", "member"]),
});

/** Change a member's role. Requires member.role.assign + authority over target. */
export async function changeMemberRoleAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const user = await requireUser();
  const parsed = roleSchema.safeParse({
    teamId: formData.get("teamId"),
    membershipId: formData.get("membershipId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const role = await teamRole(user.id, parsed.data.teamId);
  if (!role || !can(role, "member.role.assign")) return { error: "You don't have permission to change roles" };

  const [target] = await db
    .select({ role: memberships.role, userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.id, parsed.data.membershipId), eq(memberships.teamId, parsed.data.teamId)))
    .limit(1);
  if (!target) return { error: "Member not found" };
  if (target.role === "owner") return { error: "The owner's role can't be changed" };
  if (!canAssignRole(role, parsed.data.role) || !canAssignRole(role, target.role)) {
    return { error: "You can't manage that member" };
  }

  await db
    .update(memberships)
    .set({ role: parsed.data.role })
    .where(eq(memberships.id, parsed.data.membershipId));

  revalidatePath("/dashboard/teams");
  return { ok: true };
}

const removeSchema = z.object({
  teamId: z.coerce.number().int().positive(),
  membershipId: z.coerce.number().int().positive(),
});

/** Remove a member from a team. Requires member.remove + authority over target. */
export async function removeMemberAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const user = await requireUser();
  const parsed = removeSchema.safeParse({
    teamId: formData.get("teamId"),
    membershipId: formData.get("membershipId"),
  });
  if (!parsed.success) return { error: "Invalid request" };

  const role = await teamRole(user.id, parsed.data.teamId);
  if (!role || !can(role, "member.remove")) return { error: "You don't have permission to remove members" };

  const [target] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.id, parsed.data.membershipId), eq(memberships.teamId, parsed.data.teamId)))
    .limit(1);
  if (!target) return { error: "Member not found" };
  if (target.role === "owner") return { error: "The owner can't be removed" };
  if (!canAssignRole(role, target.role)) return { error: "You can't remove that member" };

  await db.delete(memberships).where(eq(memberships.id, parsed.data.membershipId));

  revalidatePath("/dashboard/teams");
  return { ok: true };
}

export type ImportState = { ok?: boolean; error?: string; added?: number; errors?: string[] } | null;

/** Bulk-import members from a CSV (email,name,role). Requires member.invite. */
export async function bulkImportMembersAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requireUser();
  const teamId = Number(formData.get("teamId"));
  const csv = formData.get("csv");
  if (!Number.isInteger(teamId) || teamId <= 0 || typeof csv !== "string") {
    return { error: "Invalid request" };
  }

  const role = await teamRole(user.id, teamId);
  if (!role || !can(role, "member.invite")) return { error: "You don't have permission to import members" };

  const { valid, errors } = validateProviderImport(parseCsvRecords(csv));
  const rowErrors = errors.map((e) => `Line ${e.line}: ${e.message}`);

  let added = 0;
  for (const row of valid) {
    // Only assign roles the caller is allowed to grant; otherwise skip the row.
    if (!canAssignRole(role, row.role as MembershipRole)) {
      rowErrors.push(`${row.email}: you can't assign role "${row.role}"`);
      continue;
    }
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, row.email))
      .limit(1);
    if (!u) {
      rowErrors.push(`${row.email}: no matching user`);
      continue;
    }
    const [existing] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.userId, u.id), eq(memberships.teamId, teamId)))
      .limit(1);
    if (existing) continue;
    await db.insert(memberships).values({
      userId: u.id,
      teamId,
      role: row.role as MembershipRole,
      accepted: false,
    });
    added++;
  }

  revalidatePath("/dashboard/teams");
  return { ok: true, added, errors: rowErrors };
}

export async function deleteTeamAction(formData: FormData): Promise<void> {
  "use server";
  const user = await requireUser();
  const teamId = Number(formData.get("teamId"));

  const [membership] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.teamId, teamId), eq(memberships.userId, user.id)));

  if (!membership || membership.role !== "owner") {
    throw new Error("Only the team owner can delete the team");
  }

  await db.delete(teams).where(eq(teams.id, teamId));
  revalidatePath("/dashboard/teams");
}
