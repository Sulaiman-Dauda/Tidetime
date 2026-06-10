import { getCurrentUser } from "@/lib/auth";
import { DashboardOverview } from "./_components/dashboard-overview";
import { getAppUrl } from "@/server/app-url";

export const metadata = { title: "Overview" };

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;
  const appUrl = await getAppUrl();

  return (
    <div className="animate-fade-in">
      <DashboardOverview
        username={user.username}
        bookingUrl={`${appUrl}/${user.username}`}
      />
    </div>
  );
}
