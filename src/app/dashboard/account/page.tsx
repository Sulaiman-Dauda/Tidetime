import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/app/dashboard/_components/page-header";
import { SettingsForms } from "./forms";
import { listTimeZones } from "@/lib/timezones";

export const metadata = { title: "Profile settings" };

export default async function AccountPage() {
  const user = await requireUser();
  const timeZones = listTimeZones();

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Profile settings"
        description="Your personal account — name, sign-in details, preferences and security."
      />
      <SettingsForms
        timeZones={timeZones}
        user={{
          name: user.name,
          position: user.position,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatarUrl,
          timeZone: user.timeZone,
          timeFormat: user.timeFormat,
          weekStart: user.weekStart,
          locale: user.locale,
          hasPassword: Boolean(user.passwordHash),
          totpEnabled: Boolean(user.totpSecret),
        }}
      />
    </div>
  );
}
