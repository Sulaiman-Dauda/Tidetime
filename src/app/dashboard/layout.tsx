import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CopyLinkButton } from "./_components/copy-link-button";
import { env } from "@/lib/env";
import { DashboardShell } from "./_components/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const bookingUrl = `${env.appUrl.replace(/^https?:\/\//, "")}/${user.username}`;

  return (
    <DashboardShell
      user={{
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl,
        isAdmin: user.isAdmin,
      }}
      copyLinkEl={<CopyLinkButton url={`${env.appUrl}/${user.username}`} label={bookingUrl} />}
    >
      {children}
    </DashboardShell>
  );
}
