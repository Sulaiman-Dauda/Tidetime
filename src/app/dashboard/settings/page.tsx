import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompanySettings } from "@/server/company-settings";
import { getCustomDomain } from "@/server/app-url";
import { PageHeader } from "@/app/dashboard/_components/page-header";
import { SettingsHub } from "./settings-hub";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Settings is the company-wide admin hub. Personal preferences live in /dashboard/account.
  if (!user.isAdmin) redirect("/dashboard/account");

  const [settings, customDomain] = await Promise.all([
    getCompanySettings(),
    getCustomDomain(),
  ]);

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Settings"
        description="Configure your company brand, booking defaults, domain, and legal pages."
      />
      <SettingsHub
        settings={settings}
        customDomain={customDomain}
      />
    </div>
  );
}
