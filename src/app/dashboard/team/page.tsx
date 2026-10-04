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
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { initials } from "@/lib/format";
import { PageHeader } from "@/app/dashboard/_components/page-header";
import { Search, SearchX, UserCog, Users } from "lucide-react";

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
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description={`People you work with${company ? ` at ${company.name}` : ""}.`}
        action={
          canManageMembers ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/providers">
                <UserCog /> Manage members
              </Link>
            </Button>
          ) : undefined
        }
      />

      <form role="search" className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name, email or position"
          aria-label="Search teammates"
          className="h-8 pl-8"
        />
      </form>

      {teammates.length === 0 ? (
        <EmptyState
          icon={search ? SearchX : Users}
          title={search ? "No matching teammates" : "No teammates yet"}
          description={search ? "Try a different search term." : "Accepted teammates will appear here."}
        />
      ) : (
        <Card>
          <ul className="divide-y">
            {teammates.map((teammate) => (
              <li key={teammate.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar className="size-9">
                  {teammate.avatarUrl ? <AvatarImage src={teammate.avatarUrl} alt="" /> : null}
                  <AvatarFallback>{initials(teammate.name ?? teammate.email)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-medium">{teammate.name ?? teammate.email}</p>
                    {teammate.id === user.id ? <Badge variant="secondary">You</Badge> : null}
                  </div>
                  <p className="truncate text-meta text-muted-foreground">
                    {teammate.position ? `${teammate.position} · ` : ""}
                    <a
                      href={`mailto:${teammate.email}`}
                      className="transition-colors hover:text-foreground"
                    >
                      {teammate.email}
                    </a>
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {teammate.role}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
