import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { services, serviceProviders, memberships, teams, users } from "@/db/schema";
import { getAppUrl } from "@/server/app-url";
import { ServiceEditor } from "./editor";
import { can } from "@/lib/rbac";
import { formatDuration, initials } from "@/lib/format";
import { locationLabel } from "@/lib/locations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ExternalLink, MapPin, type LucideIcon } from "lucide-react";
import { requireAnyPermission } from "@/lib/guard";
import { PageHeader } from "../../_components/page-header";

type Provider = { id: number; name: string | null; email: string; avatarUrl: string | null };

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
    db.select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
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
      selectedProviderIds={selected
        .map((row) => row.userId)
        .filter((id) => providers.some((provider) => provider.id === id))}
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
  providers: Provider[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/dashboard/services", label: "My services" }}
        title={service.title}
        meta={<Badge variant="secondary">Assigned</Badge>}
        description="Read-only service details. An owner or manager controls configuration and assignments."
        action={
          <Button asChild variant="outline">
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              Booking page
            </a>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Service details</CardTitle>
            {service.description ? (
              <CardDescription className="whitespace-pre-wrap leading-6">
                {service.description}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 border-t pt-5 sm:grid-cols-2">
              <Detail icon={Clock} label="Duration">
                <span className="tabular-nums">{formatDuration(service.length)}</span>
              </Detail>
              <Detail icon={MapPin} label="Location">
                {service.locations[0] ? locationLabel(service.locations[0]) : "Not configured"}
              </Detail>
            </dl>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Assigned teammates</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {providers.map((provider) => (
                <li key={provider.id} className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-8">
                    {provider.avatarUrl ? <AvatarImage src={provider.avatarUrl} alt="" /> : null}
                    <AvatarFallback>{initials(provider.name ?? provider.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{provider.name ?? provider.email}</p>
                    {provider.name ? (
                      <p className="truncate text-meta text-muted-foreground">{provider.email}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-meta text-muted-foreground">{label}</dt>
        <dd className="text-sm text-foreground">{children}</dd>
      </div>
    </div>
  );
}
