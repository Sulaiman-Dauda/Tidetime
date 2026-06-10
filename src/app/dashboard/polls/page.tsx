import { requireUser } from "@/lib/auth";
import { listPolls } from "@/server/polls";
import { getAppUrl } from "@/server/app-url";
import { PageHeader } from "@/app/dashboard/_components/page-header";
import { PollsManager } from "./polls-manager";

export const metadata = { title: "Meeting polls" };

export default async function PollsPage() {
  const user = await requireUser();
  const polls = await listPolls(user.id);
  const appUrl = await getAppUrl();

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Meeting polls"
        description="Propose a few times, let the group vote, then book the winning slot for everyone — no back-and-forth."
      />
      <PollsManager
        appUrl={appUrl}
        defaultTimeZone={user.timeZone}
        polls={polls.map((p) => ({
          id: p.id,
          token: p.token,
          title: p.title,
          status: p.status,
        }))}
      />
    </div>
  );
}
