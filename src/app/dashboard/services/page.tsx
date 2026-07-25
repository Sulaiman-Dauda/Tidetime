import Link from "next/link";
import type { Route } from "next";
import { Clock, ExternalLink, EyeOff, Zap } from "lucide-react";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { listServices } from "./actions";
import { NewServiceButton } from "../_components/new-service-button";
import { ServiceRowActions } from "../_components/service-row-actions";
import { PageHeader } from "../_components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import { getAppUrl } from "@/server/app-url";
import { locationLabel } from "@/lib/locations";
import { can } from "@/lib/rbac";
import { requireAnyPermission } from "@/lib/guard";

export const metadata = { title: "Services" };

interface Props {
  searchParams: Promise<{ welcome?: string }>;
}

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

  return (
    <div className="animate-fade-in space-y-8">
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
        <EmptyState firstRun={welcome === "1"} canManage={canManage} />
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border/60 bg-card">
          {items.map((et, index) => {
            const publicUrl = `${appUrl}/book/${company?.slug ?? "company"}/${et.slug}`;
            return (
              <div
                key={et.id}
                className="group relative flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
              >
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary/70" />

                <Link
                  href={`/dashboard/services/${et.id}` as Route}
                  className="min-w-0 flex-1"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{et.title}</span>
                    {et.draft && (
                      <Badge variant="outline" className="border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-400">
                        Draft
                      </Badge>
                    )}
                    {et.hidden && (
                      <Badge variant="secondary" className="gap-1 text-[11px]">
                        <EyeOff className="h-2.5 w-2.5" />
                        Hidden
                      </Badge>
                    )}
                    {et.requiresConfirmation && (
                      <Badge variant="outline" className="text-[11px]">
                        Confirmation required
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[12px] text-muted-foreground">
                    <span className="font-mono">
                      /book/{company?.slug ?? "company"}/{et.slug}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(et.length)}
                    </span>
                    {et.locations.length > 0 && (
                      <span>{locationLabel(et.locations[0])}</span>
                    )}
                  </div>
                </Link>

                {/* One named primary action, one preview, everything else
                    behind a labelled overflow menu. */}
                <div className="flex shrink-0 items-center gap-1">
                  <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground">
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Preview</span>
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="h-8">
                    <Link href={`/dashboard/services/${et.id}` as Route}>
                      {canManage ? "Edit" : "View"}
                    </Link>
                  </Button>
                  {canManage ? (
                    <ServiceRowActions
                      id={et.id}
                      title={et.title}
                      hidden={et.hidden}
                      canMoveUp={index > 0}
                      canMoveDown={index < items.length - 1}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  firstRun = false,
  canManage,
}: {
  firstRun?: boolean;
  canManage: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
      {firstRun ? <Badge variant="secondary" className="mb-4">Step 2 of 2</Badge> : null}
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Zap className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {canManage ? "Create your first service" : "No assigned services"}
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {!canManage
          ? "An owner or manager can assign you to a company service."
          : firstRun
          ? "Your workspace is ready. Create the first service people can book with you — we’ll open the editor right away so you can adjust duration, location, providers, questions, and more."
          : "Services are what people book — like a 30-minute consultation, a haircut, or a class. Each one gets its own booking page."}
      </p>
      {canManage ? <div className="mt-6">
        <NewServiceButton label="Create your first service" size="default" />
      </div> : null}
      {canManage ? <div className="mt-8 max-w-md space-y-3 text-left text-xs text-muted-foreground">
        <p className="font-medium text-foreground/70">After you create a service you can:</p>
        <ul className="space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] text-emerald-600">1</span>
            Set your weekly availability under <strong>Availability</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] text-emerald-600">2</span>
            Share your link <code className="rounded bg-muted px-1 py-0.5 text-[11px]">/yourname</code> with clients
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] text-emerald-600">3</span>
            Connect Google Calendar, email, and Zapier in <strong>Connections</strong>
          </li>
        </ul>
      </div> : null}
    </div>
  );
}
