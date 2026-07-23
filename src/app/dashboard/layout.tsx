import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { memberships, teams } from "@/db/schema";
import { CopyLinkButton } from "./_components/copy-link-button";
import { getAppUrl } from "@/server/app-url";
import { DashboardShell } from "./_components/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Resolve the accepted company membership used throughout this single-org UI.
  const [membership] = await db
    .select({ role: memberships.role, companySlug: teams.slug })
    .from(memberships)
    .innerJoin(teams, eq(teams.id, memberships.teamId))
    .where(and(eq(memberships.userId, user.id), eq(memberships.accepted, true)))
    .orderBy(asc(memberships.id))
    .limit(1);

  const appUrl = await getAppUrl();
  const publicUrl = `${appUrl}/book/${membership?.companySlug ?? "company"}`;
  const bookingUrl = publicUrl.replace(/^https?:\/\//, "");

  return (
    <DashboardShell
      user={{
        name: user.name,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isAdmin: user.isAdmin,
        role: membership?.role ?? "member",
      }}
      copyLinkEl={<CopyLinkButton url={publicUrl} label={bookingUrl} />}
    >
      {children}
    </DashboardShell>
  );
}
