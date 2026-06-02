import { requireUser } from "@/lib/auth";
import { SettingsForms } from "./forms";
import { ApiKeys } from "./api-keys";
import { listTimeZones } from "@/lib/timezones";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const timeZones = listTimeZones();
  const keys = await db
    .select({ id: apiKeys.id, note: apiKeys.note, lastUsedAt: apiKeys.lastUsedAt, createdAt: apiKeys.createdAt })
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.id))
    .orderBy(desc(apiKeys.createdAt));

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Manage your profile, preferences, and security.</p>
      </div>
      <SettingsForms
        timeZones={timeZones}
        user={{
          name: user.name,
          username: user.username,
          email: user.email,
          bio: user.bio,
          timeZone: user.timeZone,
          timeFormat: user.timeFormat,
          weekStart: user.weekStart,
          hasPassword: Boolean(user.passwordHash),
          reviewRequestsEnabled: user.reviewRequestsEnabled,
          googleReviewUrl: user.googleReviewUrl,
          reviewThreshold: user.reviewThreshold,
        }}
      />
      <ApiKeys keys={keys} />
    </div>
  );
}
