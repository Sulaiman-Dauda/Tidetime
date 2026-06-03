import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getCompanySettings } from "@/server/company-settings";
import { listTimeZones } from "@/lib/timezones";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { SettingsHub } from "./settings-hub";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Settings is the company-wide admin hub. Personal preferences live in /dashboard/account.
  if (!user.isAdmin) redirect("/dashboard/account");

  const [settings, timeZones, keys] = await Promise.all([
    getCompanySettings(),
    listTimeZones(),
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
          Set up your business once — branding, booking rules, email, payments and legal pages.
          These apply across your whole booking site.
        </p>
      </div>
      <SettingsHub
        settings={settings}
        timeZones={timeZones}
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
