import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, teams, users } from "@/db/schema";
import { requirePermission } from "@/lib/guard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { initials } from "@/lib/format";
import { PageHeader } from "@/app/dashboard/_components/page-header";
import { Users } from "lucide-react";

export const metadata = { title: "Team" };

export default async function TeamDirectoryPage() {
  const { user } = await requirePermission("team.directory.view");
  const [company] = await db
    .select({ id: teams.id, name: teams.name })
    .from(memberships)
    .innerJoin(teams, eq(teams.id, memberships.teamId))
    .where(and(eq(memberships.userId, user.id), eq(memberships.accepted, true)))
    .orderBy(asc(memberships.id))
    .limit(1);

  const teammates = company
    ? await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
          role: memberships.role,
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.teamId, company.id), eq(memberships.accepted, true)))
        .orderBy(asc(users.name), asc(users.email))
    : [];

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Team"
        description={`People you work with${company ? ` at ${company.name}` : ""}.`}
      />
      {teammates.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teammates yet"
          description="Accepted teammates will appear here."
        />
      ) : (
        <Card className="divide-y divide-border/60 overflow-hidden">
          {teammates.map((teammate) => (
            <div key={teammate.id} className="flex items-center gap-4 px-5 py-4">
              <Avatar className="h-10 w-10">
                {teammate.avatarUrl ? <AvatarImage src={teammate.avatarUrl} alt="" /> : null}
                <AvatarFallback>{initials(teammate.name ?? teammate.email)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {teammate.name ?? teammate.email}
                  {teammate.id === user.id ? " (you)" : ""}
                </p>
                <a
                  href={`mailto:${teammate.email}`}
                  className="truncate text-xs text-muted-foreground hover:text-foreground"
                >
                  {teammate.email}
                </a>
              </div>
              <Badge variant="outline" className="capitalize">
                {teammate.role}
              </Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
