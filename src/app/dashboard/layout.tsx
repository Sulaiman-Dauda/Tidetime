import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "./_components/sidebar";
import { CopyLinkButton } from "./_components/copy-link-button";
import { env } from "@/lib/env";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const bookingUrl = `${env.appUrl.replace(/^https?:\/\//, "")}/${user.username}`;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        user={{
          name: user.name,
          username: user.username,
          avatarUrl: user.avatarUrl,
          isAdmin: user.isAdmin,
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border/60 bg-background/90 px-8 backdrop-blur-sm">
          <CopyLinkButton url={`${env.appUrl}/${user.username}`} label={bookingUrl} />
          {/* Spacer — right slot intentionally minimal */}
          <div />
        </header>

        {/* Content */}
        <main className="flex-1 px-8 py-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
