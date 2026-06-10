import { requireUser } from "@/lib/auth";
import { listRoutingForms } from "@/server/routing-forms";
import { getAppUrl } from "@/server/app-url";
import { PageHeader } from "@/app/dashboard/_components/page-header";
import { RoutingManager } from "./routing-manager";

export const metadata = { title: "Routing forms" };

export default async function RoutingFormsPage() {
  const user = await requireUser();
  const forms = await listRoutingForms(user.id);
  const appUrl = await getAppUrl();

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Routing forms"
        description="Ask a few questions, then send each respondent to the right service, link, or message based on their answers."
      />
      <RoutingManager
        appUrl={appUrl}
        forms={forms.map((f) => ({
          id: f.id,
          name: f.name,
          slug: f.slug,
          active: f.active,
          fields: f.fields.length,
          routes: f.routes.length,
        }))}
      />
    </div>
  );
}
