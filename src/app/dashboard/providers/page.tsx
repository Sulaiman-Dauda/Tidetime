import { requireAnyPermission } from "@/lib/guard";
import { db } from "@/db";
import { teams, memberships } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { PageHeader } from "@/app/dashboard/_components/page-header";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Providers" };

export default async function ProvidersPage() {
  const { user } = await requireAnyPermission([
    "member.invite",
    "member.remove",
    "member.role.assign",
  ]);

  const rows = await db
    .select({ team: teams, role: memberships.role })
    .from(memberships)
    .innerJoin(teams, eq(memberships.teamId, teams.id))
    .where(eq(memberships.userId, user.id));

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Providers"
        description="Invite providers and manage company membership."
      />

      {rows.length === 0 ? (
        <EmptyState
          brand
          title="No company configured"
          description="Complete first-run setup to create your company."
        />
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border/60 bg-card">
          {rows.map(({ team, role }) => (
            <Link
              key={team.id}
              href={`/dashboard/providers/${team.id}` as Route}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
            >
              <Avatar className="h-9 w-9 shrink-0">
                {team.logoUrl && <AvatarImage src={team.logoUrl} alt="" />}
                <AvatarFallback>{initials(team.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{team.name}</span>
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
