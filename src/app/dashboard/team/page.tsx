import Link from "next/link";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { memberships, teams, users } from "@/db/schema";
import { requirePermission } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { initials } from "@/lib/format";
import { PageHeader } from "@/app/dashboard/_components/page-header";
import { UserCog } from "lucide-react";

export const metadata = { title: "Team" };

export default async function TeamDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { user, role, teamId } = await requirePermission("team.directory.view");
  const { q } = await searchParams;
  const [company] = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  const filters = [eq(memberships.teamId, teamId), eq(memberships.accepted, true)];
  const search = q?.trim();
  if (search) {
    const like = `%${search}%`;
    filters.push(or(ilike(users.name, like), ilike(users.email, like), ilike(users.position, like))!);
  }

  const teammates = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      position: users.position,
      avatarUrl: users.avatarUrl,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(...filters))
    .orderBy(asc(users.name), asc(users.email));

  const canManageMembers = can(role, "member.invite");

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Team"
        description={`People you work with${company ? ` at ${company.name}` : ""}.`}
        action={
          canManageMembers ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/providers">
                <UserCog className="h-4 w-4" /> Manage members
              </Link>
            </Button>
          ) : undefined
        }
      />

      <form className="max-w-sm">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name, email or position…"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>

      {teammates.length === 0 ? (
        <EmptyState
          brand
          title={search ? "No matching teammates" : "No teammates yet"}
          description={search ? "Try a different search term." : "Accepted teammates will appear here."}
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
                  {teammate.position ? (
                    <span className="font-normal text-muted-foreground"> · {teammate.position}</span>
                  ) : null}
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
