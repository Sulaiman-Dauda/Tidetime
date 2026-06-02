import { getCurrentUser } from "@/lib/auth";
import { DashboardOverview } from "./_components/dashboard-overview";
import { env } from "@/lib/env";

export const metadata = { title: "Overview" };

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;

  return (
    <div className="animate-fade-in">
      <DashboardOverview
        username={user.username}
        bookingUrl={`${env.appUrl}/${user.username}`}
      />
    </div>
  );
}
