import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getCompanySettings } from "@/server/company-settings";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { SettingsHub } from "./settings-hub";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Settings is the company-wide admin hub. Personal preferences live in /dashboard/account.
  if (!user.isAdmin) redirect("/dashboard/account");

  const [settings, keys] = await Promise.all([
    getCompanySettings(),
    db
      .select({ id: apiKeys.id, note: apiKeys.note, lastUsedAt: apiKeys.lastUsedAt, createdAt: apiKeys.createdAt })
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id))
      .orderBy(desc(apiKeys.createdAt)),
  ]);

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Configure branding, booking defaults, email, Google Calendar, Stripe checkout, reviews, API keys, and legal pages.
        </p>
      </div>
      <SettingsHub
        settings={settings}
        review={{
          reviewRequestsEnabled: user.reviewRequestsEnabled,
          googleReviewUrl: user.googleReviewUrl,
          reviewThreshold: user.reviewThreshold,
        }}
        apiKeys={keys}
      />
    </div>
  );
}
