import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { services, serviceProviders, memberships, teams, users } from "@/db/schema";
import { getAppUrl } from "@/server/app-url";
import { ServiceEditor } from "./editor";
import { can } from "@/lib/rbac";
import { formatDuration } from "@/lib/format";
import { locationLabel } from "@/lib/locations";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, ExternalLink, MapPin, Users as UsersIcon } from "lucide-react";
import Link from "next/link";
import { requireAnyPermission } from "@/lib/guard";

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, teamId } = await requireAnyPermission([
    "service.catalog.view",
    "service.catalog.manage",
    "service.assigned.view",
  ]);
  const serviceId = Number(id);
  if (!Number.isInteger(serviceId)) notFound();

  const [company] = await db
    .select({ teamSlug: teams.slug })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!company) notFound();

  const [service] = await db.select().from(services)
    .where(and(eq(services.id, serviceId), eq(services.teamId, teamId))).limit(1);
  if (!service) notFound();

  const canManage = can(role, "service.catalog.manage");
  if (!canManage && !can(role, "service.assigned.view")) notFound();

  const [providers, selected] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email })
      .from(memberships).innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.teamId, teamId), eq(memberships.accepted, true)))
      .orderBy(asc(users.name)),
    db.select({ userId: serviceProviders.userId }).from(serviceProviders)
      .where(eq(serviceProviders.serviceId, serviceId)),
  ]);
  if (!canManage && !selected.some((row) => row.userId === user.id)) notFound();

  const appUrl = await getAppUrl();
  if (!canManage) {
    return (
      <AssignedServiceView
        service={service}
        publicUrl={`${appUrl}/book/${company.teamSlug}/${service.slug}`}
        providers={providers.filter((provider) =>
          selected.some((row) => row.userId === provider.id),
        )}
      />
    );
  }

  return (
    <ServiceEditor
      service={service}
      teamSlug={company.teamSlug}
      appUrl={appUrl}
      providers={providers}
      selectedProviderIds={selected.map((row) => row.userId)}
    />
  );
}

function AssignedServiceView({
  service,
  publicUrl,
  providers,
}: {
  service: typeof services.$inferSelect;
  publicUrl: string;
  providers: { id: number; name: string | null; email: string }[];
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard/services">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{service.title}</h1>
            <Badge variant="secondary">Assigned</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only service details. An owner or manager controls configuration and assignments.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Booking page
          </a>
        </Button>
      </div>

      <Card className="space-y-5 p-6">
        <div>
          <h2 className="text-sm font-semibold">Service details</h2>
          {service.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {service.description}
            </p>
          ) : null}
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <dt className="text-xs text-muted-foreground">Duration</dt>
              <dd>{formatDuration(service.length)}</dd>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <dt className="text-xs text-muted-foreground">Location</dt>
              <dd>{service.locations[0] ? locationLabel(service.locations[0]) : "Not configured"}</dd>
            </div>
          </div>
        </dl>
        <div className="border-t border-border/60 pt-5">
          <div className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Assigned teammates</h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {providers.map((provider) => (
              <Badge key={provider.id} variant="outline">
                {provider.name ?? provider.email}
              </Badge>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
