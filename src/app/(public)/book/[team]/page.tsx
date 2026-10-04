import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { CalendarX, ChevronRight, Clock } from "lucide-react";
import { getPublicTeam, getTeamServices } from "@/server/teams-public";
import { isBookingDisabled } from "@/server/company-settings";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { formatDuration, formatNextAvailable } from "@/lib/format";
import { PublicLegal } from "../../_components/public-legal";
import { CompanyBrandHeader } from "../../_components/company-brand-header";
import { BookingUnavailable } from "../../_components/booking-unavailable";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ team: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team: slug } = await params;
  const team = await getPublicTeam(slug);
  if (!team) return { title: "Not found" };
  return { title: `${team.name} · Tidetime`, description: `Book a service with ${team.name}.` };
}

export default async function TeamLandingPage({ params }: Props) {
  const { team: slug } = await params;
  const team = await getPublicTeam(slug);
  if (!team) notFound();

  const [events, disabled] = await Promise.all([
    getTeamServices(team.id),
    isBookingDisabled(),
  ]);

  if (disabled) return <BookingUnavailable />;

  return (
    <main className="flex min-h-screen flex-col bg-canvas">
      <CompanyBrandHeader />
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-14">
        <div className="overflow-hidden rounded-2xl bg-card text-card-foreground shadow-popover">
          <div className="border-b px-5 py-5 sm:px-6">
            <h1 className="text-2xl font-semibold tracking-tight">Choose a service</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick the type of appointment you want. You&apos;ll choose a time on the next screen.
            </p>
          </div>

          {events.length === 0 ? (
            <EmptyState
              bare
              icon={CalendarX}
              title="No services to book yet"
              description="Please check back soon."
            />
          ) : (
            <ul className="divide-y">
              {events.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/book/${slug}/${e.slug}` as Route}
                    className="group flex items-center gap-4 px-5 py-4 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40 sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold tracking-tight text-foreground">
                        {e.title}
                      </h2>
                      {e.description ? (
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                          {e.description}
                        </p>
                      ) : null}
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-meta text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          <Clock className="size-3.5" aria-hidden />
                          {formatDuration(e.length)}
                        </span>
                        {e.nextAvailable ? (
                          <Badge variant="success" dot className="tabular-nums">
                            Next available {formatNextAvailable(new Date(e.nextAvailable), "UTC")}
                          </Badge>
                        ) : (
                          <span>No times in the next 30 days</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <PublicLegal />
    </main>
  );
}
