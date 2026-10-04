import Link from "next/link";
import type { Route } from "next";
import { Layers } from "lucide-react";
import { db } from "@/db";
import { serviceProviders, teams, users } from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { listServices } from "./actions";
import { NewServiceButton } from "../_components/new-service-button";
import { ServiceRowActions } from "../_components/service-row-actions";
import { PageHeader } from "../_components/page-header";
import { CopyLinkButton } from "../_components/copy-link-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { formatDuration, initials } from "@/lib/format";
import { getAppUrl } from "@/server/app-url";
import { locationLabel } from "@/lib/locations";
import { can } from "@/lib/rbac";
import { requireAnyPermission } from "@/lib/guard";

export const metadata = { title: "Services" };

interface Props {
  searchParams: Promise<{ welcome?: string }>;
}

type Provider = { id: number; name: string | null; email: string; avatarUrl: string | null };

export default async function ServicesPage({ searchParams }: Props) {
  const { welcome } = await searchParams;
  const { role, teamId } = await requireAnyPermission([
    "service.catalog.view",
    "service.catalog.manage",
    "service.assigned.view",
  ]);
  const items = await listServices();
  const appUrl = await getAppUrl();
  const [company] = await db
    .select({ slug: teams.slug })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  const canManage = can(role, "service.catalog.manage");
  const companySlug = company?.slug ?? "company";

  // listServices is already scoped to this company, so its ids bound the lookup.
  const assignments = items.length
    ? await db
        .select({
          serviceId: serviceProviders.serviceId,
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        })
        .from(serviceProviders)
        .innerJoin(users, eq(users.id, serviceProviders.userId))
        .where(inArray(serviceProviders.serviceId, items.map((service) => service.id)))
        .orderBy(asc(users.name))
    : [];
  const providersByService = new Map<number, Provider[]>();
  for (const { serviceId, ...provider } of assignments) {
    providersByService.set(serviceId, [...(providersByService.get(serviceId) ?? []), provider]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description={
          canManage
            ? "Create and manage the services people can book."
            : "Services you are currently assigned to deliver."
        }
        action={canManage ? <NewServiceButton /> : undefined}
      />

      {items.length === 0 ? (
        canManage ? (
          <FirstServiceEmptyState firstRun={welcome === "1"} />
        ) : (
          <EmptyState
            icon={Layers}
            title="No assigned services"
            description="An owner or manager can assign you to a company service."
          />
        )
      ) : (
        <Card className="divide-y overflow-hidden">
          {items.map((service, index) => {
            const path = `/book/${companySlug}/${service.slug}`;
            const providers = providersByService.get(service.id) ?? [];
            return (
              <div
                key={service.id}
                className="relative flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    {/* The link stretches over the whole row; the controls on
                        the right sit above it. */}
                    <Link
                      href={`/dashboard/services/${service.id}` as Route}
                      className="truncate text-sm font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:underline"
                    >
                      {service.title}
                    </Link>
                    <ServiceStatus draft={service.draft} hidden={service.hidden} />
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-meta text-muted-foreground">
                    <span className="tabular-nums">{formatDuration(service.length)}</span>
                    {service.locations.length > 0 ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{locationLabel(service.locations[0])}</span>
                      </>
                    ) : null}
                    {service.requiresConfirmation ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>Needs confirmation</span>
                      </>
                    ) : null}
                  </p>
                </div>

                {providers.length > 0 ? (
                  <ProviderStack providers={providers} className="relative hidden md:flex" />
                ) : null}
                {/* Drafts have no public page yet, so there is no link to share. */}
                {service.draft ? null : (
                  <div className="relative min-w-0">
                    <CopyLinkButton url={`${appUrl}${path}`} label={path} />
                  </div>
                )}
                {canManage ? (
                  <div className="relative">
                    <ServiceRowActions
                      id={service.id}
                      title={service.title}
                      hidden={service.hidden}
                      canMoveUp={index > 0}
                      canMoveDown={index < items.length - 1}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

/** Shown to roles that can create services. Setup lands here with ?welcome=1. */
function FirstServiceEmptyState({ firstRun }: { firstRun: boolean }) {
  return (
    <div className="rounded-xl border bg-card shadow-xs">
      {firstRun ? (
        <div className="flex justify-center pt-10">
          <Badge variant="secondary">Step 2 of 2</Badge>
        </div>
      ) : null}
      <EmptyState
        bare
        icon={Layers}
        className={firstRun ? "pt-4" : undefined}
        title="Create your first service"
        description={
          firstRun
            ? "Your workspace is ready. Create the first service people can book and the editor opens straight away."
            : "A service is what people book, like a 30-minute consultation or a class. Each one gets its own booking page."
        }
        action={<NewServiceButton label="Create your first service" size="default" />}
      />
      <div className="border-t px-6 py-5">
        <div className="mx-auto max-w-sm">
          <p className="text-meta font-medium text-foreground">After you create a service you can</p>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            {FIRST_SERVICE_NEXT_STEPS.map((step, index) => (
              <li key={index} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-meta font-medium tabular-nums text-accent-foreground">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

const FIRST_SERVICE_NEXT_STEPS = [
  <>
    Set your weekly hours under <span className="font-medium text-foreground">Availability</span>
  </>,
  <>Share its booking page link with your customers</>,
  <>
    Connect Google Calendar, email and Zapier in{" "}
    <span className="font-medium text-foreground">Connections</span>
  </>,
];

function ServiceStatus({ draft, hidden }: { draft: boolean; hidden: boolean }) {
  if (draft) return <Badge variant="warning" dot>Draft</Badge>;
  if (hidden) return <Badge variant="secondary">Hidden</Badge>;
  return <Badge variant="success" dot>Public</Badge>;
}

const STACK_LIMIT = 3;

function ProviderStack({ providers, className }: { providers: Provider[]; className?: string }) {
  const shown = providers.slice(0, STACK_LIMIT);
  const extra = providers.length - shown.length;
  const names = providers.map((provider) => provider.name ?? provider.email).join(", ");
  // A native title rather than Tooltip: Radix's asChild trigger drops
  // server-rendered children during SSR here, which broke hydration.
  return (
    <div className={className} title={names}>
      <span className="sr-only">Providers: {names}</span>
      <div className="flex -space-x-1.5" aria-hidden>
        {shown.map((provider) => (
          <Avatar key={provider.id} className="size-7 ring-2 ring-card">
            {provider.avatarUrl ? <AvatarImage src={provider.avatarUrl} alt="" /> : null}
            <AvatarFallback>{initials(provider.name ?? provider.email)}</AvatarFallback>
          </Avatar>
        ))}
        {extra > 0 ? (
          <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-medium tabular-nums text-muted-foreground ring-2 ring-card">
            +{extra}
          </span>
        ) : null}
      </div>
    </div>
  );
}
