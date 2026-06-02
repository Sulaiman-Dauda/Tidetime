import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { teams, memberships, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { TeamMembers } from "./members";

export const metadata = { title: "Team" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TeamDetailPage({ params }: Props) {
  const { id } = await params;
  const teamId = Number(id);
  if (!Number.isInteger(teamId)) notFound();

  const user = await requireUser();

  const [self] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, user.id), eq(memberships.teamId, teamId)))
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

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{team.name}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage members, roles, and bulk imports for this team.
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
      />
    </div>
  );
}
