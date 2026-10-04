import { asc } from "drizzle-orm";
import { requirePermission } from "@/lib/guard";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { PageHeader } from "@/app/dashboard/_components/page-header";
import { GoogleCalendarSettings } from "./google-calendar-settings";
import { MicrosoftCalendarSettings } from "./microsoft-calendar-settings";
import { EmailSettings } from "./email-settings";
import { WebhookManager } from "./webhook-manager";

export const metadata = { title: "Connections" };

export default async function IntegrationsPage() {
  const { user } = await requirePermission("connection.own.manage");
  const hooks = user.isAdmin
    ? await db.select().from(webhooks).orderBy(asc(webhooks.createdAt))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connections"
        description={user.isAdmin
          ? "Connect calendars, email delivery and Zapier webhooks."
          : "Connect your calendar to prevent conflicts and keep bookings in sync."}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <GoogleCalendarSettings />
        <MicrosoftCalendarSettings />
      </div>
      {user.isAdmin ? <EmailSettings /> : null}
      {user.isAdmin ? <WebhookManager hooks={hooks} /> : null}
    </div>
  );
}
