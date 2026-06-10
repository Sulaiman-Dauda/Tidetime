import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { CopyLinkButton } from "./_components/copy-link-button";
import { getAppUrl } from "@/server/app-url";
import { DashboardShell } from "./_components/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Fetch team role for single-org deployment
  const [membership] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .limit(1);

  const appUrl = await getAppUrl();
  const bookingUrl = `${appUrl.replace(/^https?:\/\//, "")}/${user.username}`;

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
      copyLinkEl={<CopyLinkButton url={`${appUrl}/${user.username}`} label={bookingUrl} />}
    >
      {children}
    </DashboardShell>
  );
}
