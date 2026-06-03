import { requirePermission } from "@/lib/guard";
import { db } from "@/db";
import { teams, memberships } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { CreateTeam } from "./create-team";
import { Users } from "lucide-react";

export const metadata = { title: "Teams" };

export default async function TeamsPage() {
  const { user } = await requirePermission("team.view");

  const rows = await db
    .select({ team: teams, role: memberships.role })
    .from(memberships)
    .innerJoin(teams, eq(memberships.teamId, teams.id))
    .where(eq(memberships.userId, user.id));

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Teams</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Collaborate on shared event types and round-robin scheduling.
          </p>
        </div>
        <CreateTeam />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-20 text-center">
          <Users className="h-7 w-7 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">No teams yet</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Create a team to collaborate on collective and round-robin events.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border/60 bg-card">
          {rows.map(({ team, role }) => (
            <Link
              key={team.id}
              href={`/dashboard/teams/${team.id}` as Route}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
            >
              <Avatar className="h-9 w-9 shrink-0">
                {team.logoUrl && <AvatarImage src={team.logoUrl} alt="" />}
                <AvatarFallback>{initials(team.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-foreground">{team.name}</span>
                  <Badge variant="secondary" className="capitalize text-[11px]">
                    {role}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[12px] font-mono text-muted-foreground">/{team.slug}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
