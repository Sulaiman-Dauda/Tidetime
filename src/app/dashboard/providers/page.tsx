import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireAnyPermission } from "@/lib/guard";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { PageHeader } from "@/app/dashboard/_components/page-header";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Members" };

/**
 * Single-company product: skip the redundant company list and land straight on
 * the member-management page for the user's company.
 */
export default async function MembersIndexPage() {
  const { user } = await requireAnyPermission([
    "member.invite",
    "member.remove",
    "member.role.assign",
  ]);

  const [membership] = await db
    .select({ teamId: memberships.teamId })
    .from(memberships)
    .where(and(eq(memberships.userId, user.id), eq(memberships.accepted, true)))
    .limit(1);

  if (membership) redirect(`/dashboard/providers/${membership.teamId}`);

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader title="Members" description="Invite people and manage company membership." />
      <EmptyState
        brand
        title="No company configured"
        description="Complete first-run setup to create your company."
      />
    </div>
  );
}
