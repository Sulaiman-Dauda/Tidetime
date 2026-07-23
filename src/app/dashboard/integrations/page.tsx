import { asc } from "drizzle-orm";
import { requirePermission } from "@/lib/guard";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { PageHeader } from "@/app/dashboard/_components/page-header";
import { GoogleCalendarSettings } from "./google-calendar-settings";
import { EmailSettings } from "./email-settings";
import { WebhookManager } from "./webhook-manager";

export const metadata = { title: "Connections" };

export default async function IntegrationsPage() {
  const { user } = await requirePermission("connection.own.manage");
  const hooks = user.isAdmin
    ? await db.select().from(webhooks).orderBy(asc(webhooks.createdAt))
    : [];

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Connections"
        description={user.isAdmin
          ? "Connect calendars, email delivery, and Zapier webhooks."
          : "Connect your calendar to prevent conflicts and keep bookings in sync."}
      />
      <div className={user.isAdmin ? "grid gap-6 lg:grid-cols-2" : "max-w-2xl"}>
        <GoogleCalendarSettings />
        {user.isAdmin ? <EmailSettings /> : null}
      </div>
      {user.isAdmin ? <WebhookManager hooks={hooks} /> : null}
    </div>
  );
}
