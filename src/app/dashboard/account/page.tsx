import { requireUser } from "@/lib/auth";
import { SettingsForms } from "./forms";
import { listTimeZones } from "@/lib/timezones";

export const metadata = { title: "Profile settings" };

export default async function AccountPage() {
  const user = await requireUser();
  const timeZones = listTimeZones();

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Profile settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Your personal account — name, sign-in details, preferences and security.
        </p>
      </div>
      <SettingsForms
        timeZones={timeZones}
        user={{
          name: user.name,
          username: user.username,
          email: user.email,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
          timeZone: user.timeZone,
          timeFormat: user.timeFormat,
          weekStart: user.weekStart,
          hasPassword: Boolean(user.passwordHash),
        }}
      />
    </div>
  );
}
