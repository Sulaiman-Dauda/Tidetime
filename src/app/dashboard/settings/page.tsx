import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getCompanySettings } from "@/server/company-settings";
import { getCustomDomain } from "@/server/app-url";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { PageHeader } from "@/app/dashboard/_components/page-header";
import { SettingsHub } from "./settings-hub";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Settings is the company-wide admin hub. Personal preferences live in /dashboard/account.
  if (!user.isAdmin) redirect("/dashboard/account");

  const [settings, keys, customDomain] = await Promise.all([
    getCompanySettings(),
    db
      .select({ id: apiKeys.id, note: apiKeys.note, lastUsedAt: apiKeys.lastUsedAt, createdAt: apiKeys.createdAt })
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id))
      .orderBy(desc(apiKeys.createdAt)),
    getCustomDomain(),
  ]);

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Settings"
        description="Configure branding, booking defaults, email, Google Calendar, Stripe checkout, reviews, API keys, and legal pages."
      />
      <SettingsHub
        settings={settings}
        review={{
          reviewRequestsEnabled: user.reviewRequestsEnabled,
          googleReviewUrl: user.googleReviewUrl,
          reviewThreshold: user.reviewThreshold,
        }}
        apiKeys={keys}
        customDomain={customDomain}
      />
    </div>
  );
}
