import { redirect } from "next/navigation";
import { and, eq, count } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { CopyLinkButton } from "./_components/copy-link-button";
import { env } from "@/lib/env";
import { DashboardShell } from "./_components/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const bookingUrl = `${env.appUrl.replace(/^https?:\/\//, "")}/${user.username}`;

  const [pendingRow] = await db
    .select({ count: count() })
    .from(bookings)
    .where(and(eq(bookings.userId, user.id), eq(bookings.status, "pending")));
  const pendingCount = pendingRow?.count ?? 0;

  return (
    <DashboardShell
      user={{
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl,
        isAdmin: user.isAdmin,
      }}
      copyLinkEl={<CopyLinkButton url={`${env.appUrl}/${user.username}`} label={bookingUrl} />}
      pendingBookings={pendingCount}
    >
      {children}
    </DashboardShell>
  );
}
