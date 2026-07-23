import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/guard";
import { db } from "@/db";
import { teams, memberships, users, invites } from "@/db/schema";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getAppUrl } from "@/server/app-url";
import { TeamMembers } from "./members";

export const metadata = { title: "Providers" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProviderDetailPage({ params }: Props) {
  const { id } = await params;
  const teamId = Number(id);
  if (!Number.isInteger(teamId)) notFound();

  const { user } = await requireAnyPermission([
    "member.invite",
    "member.remove",
    "member.role.assign",
  ]);

  const [self] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, user.id),
        eq(memberships.teamId, teamId),
        eq(memberships.accepted, true),
      ),
    )
    .limit(1);
  if (!self) notFound();

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) notFound();

  const members = await db
    .select({
      membershipId: memberships.id,
      role: memberships.role,
      accepted: memberships.accepted,
      userId: users.id,
      name: users.name,
      email: users.email,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.teamId, teamId));

  // Pending (unaccepted, unexpired) invitations — with a shareable signup link
  // so admins aren't blocked when email delivery isn't configured.
  const appUrl = await getAppUrl();
  const pending = await db
    .select({
      id: invites.id,
      email: invites.email,
      role: invites.role,
      token: invites.token,
      expiresAt: invites.expiresAt,
      createdAt: invites.createdAt,
      invitedBy: users.name,
      invitedByUsername: users.username,
    })
    .from(invites)
    .leftJoin(users, eq(users.id, invites.createdBy))
    .where(and(eq(invites.teamId, teamId), isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())))
    .orderBy(desc(invites.id));
  const pendingInvites = pending.map((p) => ({
    id: p.id,
    email: p.email,
    role: p.role,
    url: `${appUrl}/signup?invite=${p.token}`,
    expiresAt: p.expiresAt.toISOString(),
    invitedAt: p.createdAt.toISOString(),
    invitedBy: p.invitedBy ?? p.invitedByUsername ?? null,
  }));

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{team.name}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage the people who can deliver your company services.
        </p>
      </div>

      <TeamMembers
        teamId={teamId}
        viewerRole={self.role}
        members={members.map((m) => ({
          membershipId: m.membershipId,
          role: m.role,
          accepted: m.accepted,
          name: m.name,
          email: m.email,
        }))}
        pendingInvites={pendingInvites}
      />
    </div>
  );
}
