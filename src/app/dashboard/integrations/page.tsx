import { requirePermission } from "@/lib/guard";
import { getCurrentUser } from "@/lib/auth";
import { getAppStatuses } from "@/app-store/registry";
import { getCredentialStatuses } from "@/server/integration-credentials";
import { getLicenseInfo } from "@/server/license";
import { getFeatureFlags } from "@/server/feature-flags";
import { getAppUrl } from "@/server/app-url";
import { PageHeader } from "@/app/dashboard/_components/page-header";
import { IntegrationsHub } from "./integrations-hub";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const { role } = await requirePermission("team.manage");
  const user = await getCurrentUser();
  const [statuses, credentialStatuses, license, flags] = await Promise.all([
    user ? getAppStatuses(user.id) : Promise.resolve([]),
    getCredentialStatuses(),
    getLicenseInfo(),
    getFeatureFlags(),
  ]);
  const appUrl = await getAppUrl();

  const isAdmin = Boolean(user?.isAdmin) || role === "owner" || role === "admin";
  // CRM is a business feature: only surface its cards once the instance opts in.
  const crm = flags.crm ? statuses.filter((a) => a.category === "crm") : [];

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Integrations"
        description="Connect Tidetime to your calendar, video, CRM, payments and email. Staff connect their own accounts in one click; an admin sets up provider credentials once under Setup."
      />
      <IntegrationsHub
        appUrl={appUrl}
        video={statuses.filter((a) => a.category === "video")}
        crm={crm}
        credentialStatuses={credentialStatuses}
        isAdmin={isAdmin}
        edition={{ licensed: license.edition === "licensed", plan: license.plan ?? null }}
      />
    </div>
  );
}
