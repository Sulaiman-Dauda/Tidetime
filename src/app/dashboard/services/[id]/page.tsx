import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { services, serviceProviders, memberships, teams, users } from "@/db/schema";
import { getAppUrl } from "@/server/app-url";
import { ServiceEditor } from "./editor";

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getCurrentUser())!;
  const serviceId = Number(id);
  if (!Number.isInteger(serviceId)) notFound();

  const [company] = await db.select({ teamId: memberships.teamId, teamSlug: teams.slug })
    .from(memberships).innerJoin(teams, eq(teams.id, memberships.teamId))
    .where(and(eq(memberships.userId, user.id), eq(memberships.accepted, true)))
    .orderBy(asc(memberships.id)).limit(1);
  if (!company) notFound();

  const [service] = await db.select().from(services)
    .where(and(eq(services.id, serviceId), eq(services.teamId, company.teamId))).limit(1);
  if (!service) notFound();

  const [providers, selected] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email })
      .from(memberships).innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.teamId, company.teamId), eq(memberships.accepted, true)))
      .orderBy(asc(users.name)),
    db.select({ userId: serviceProviders.userId }).from(serviceProviders)
      .where(eq(serviceProviders.serviceId, serviceId)),
  ]);

  return (
    <ServiceEditor
      service={service}
      teamSlug={company.teamSlug}
      appUrl={await getAppUrl()}
      providers={providers}
      selectedProviderIds={selected.map((row) => row.userId)}
    />
  );
}
