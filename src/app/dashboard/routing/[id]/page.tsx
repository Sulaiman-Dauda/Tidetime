import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getRoutingForm, listRoutableEventTypes } from "@/server/routing-forms";
import { getAppUrl } from "@/server/app-url";
import { RoutingFormEditor } from "./editor";

export const metadata = { title: "Edit routing form" };

export default async function RoutingFormEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const formId = Number(id);
  if (!Number.isFinite(formId)) notFound();

  const [form, eventTypes] = await Promise.all([
    getRoutingForm(formId, user.id),
    listRoutableEventTypes(user.id),
  ]);
  if (!form) notFound();

  const appUrl = await getAppUrl();

  return (
    <RoutingFormEditor
      appUrl={appUrl}
      form={{
        id: form.id,
        name: form.name,
        slug: form.slug,
        description: form.description,
        fields: form.fields,
        routes: form.routes,
        fallback: form.fallback,
        active: form.active,
      }}
      eventTypes={eventTypes}
    />
  );
}
