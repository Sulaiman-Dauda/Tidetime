"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { invites, memberships, teams, users } from "@/db/schema";
import { can, canAssignRole } from "@/lib/rbac";
import { inviteEmail } from "@/server/emails";
import { sendMail } from "@/server/mailer";
import { randomToken } from "@/lib/crypto";

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  teamId: z.coerce.number().int(),
  role: z.enum(["admin", "manager", "provider", "receptionist", "member"]),
});

export type InviteState = { ok?: boolean; error?: string } | null;

export async function createInviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const user = await requireUser();
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    teamId: formData.get("teamId"),
    role: formData.get("role") || "member",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const [membership] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.teamId, parsed.data.teamId), eq(memberships.userId, user.id)))
    .limit(1);
  if (!membership || !can(membership.role, "member.invite")) {
    return { error: "You don't have permission to invite members" };
  }
  if (!canAssignRole(membership.role, parsed.data.role)) {
    return { error: "You can't assign that role" };
  }

  const [existingMember] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(memberships, eq(users.id, memberships.userId))
    .where(and(eq(users.email, parsed.data.email), eq(memberships.teamId, parsed.data.teamId)))
    .limit(1);
  if (existingMember) return { error: "This person is already a team member" };

  const [existingInvite] = await db
    .select({ id: invites.id })
    .from(invites)
    .where(and(eq(invites.email, parsed.data.email), eq(invites.teamId, parsed.data.teamId), isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())))
    .limit(1);
  if (existingInvite) return { error: "An active invite already exists for this email" };

  const token = randomToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(invites).values({
    token,
    email: parsed.data.email,
    teamId: parsed.data.teamId,
    role: parsed.data.role,
    createdBy: user.id,
    expiresAt,
  });

  const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, parsed.data.teamId)).limit(1);
  const appUrl = process.env.APP_URL || "http://localhost:3100";
  const inviteUrl = `${appUrl}/signup?invite=${token}`;

  const email = await inviteEmail({
    teamName: team?.name ?? "the team",
    inviterName: user.name ?? user.username,
    inviteUrl,
  });

  await sendMail({ to: parsed.data.email, subject: email.subject, html: email.html });

  revalidatePath("/dashboard/teams");
  return { ok: true };
}
