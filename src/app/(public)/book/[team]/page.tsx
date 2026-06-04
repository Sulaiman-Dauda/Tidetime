import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { getPublicTeam, getTeamEventTypes } from "@/server/teams-public";
import { isBookingDisabled } from "@/server/company-settings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { initials, formatDuration, formatNextAvailable } from "@/lib/format";
import { AlertTriangle, Clock, Users, ArrowRight } from "lucide-react";
import { PublicLegal } from "../../_components/public-legal";
import { CompanyBrandHeader } from "../../_components/company-brand-header";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ team: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team: slug } = await params;
  const team = await getPublicTeam(slug);
  if (!team) return { title: "Not found" };
  return { title: `${team.name} · Tidetime`, description: team.bio ?? `Book time with ${team.name}.` };
}

export default async function TeamLandingPage({ params }: Props) {
  const { team: slug } = await params;
  const team = await getPublicTeam(slug);
  if (!team) notFound();

  const [events, disabled] = await Promise.all([
    getTeamEventTypes(team.id),
    isBookingDisabled(),
  ]);

  if (disabled) {
    return (
      <main className="min-h-screen bg-grid">
        <CompanyBrandHeader />
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Booking temporarily unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Online booking is currently disabled while we make some improvements.
            Please check back soon or contact us directly.
          </p>
        </div>
        <PublicLegal />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-grid">
      <CompanyBrandHeader />
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="flex flex-col items-center text-center">
          <Avatar className="h-20 w-20">
            {team.logoUrl ? <AvatarImage src={team.logoUrl} alt={team.name} /> : null}
            <AvatarFallback>{initials(team.name)}</AvatarFallback>
          </Avatar>
          <h1 className="mt-4 text-2xl font-semibold">{team.name}</h1>
          {team.bio ? <p className="mt-2 max-w-md text-sm text-muted-foreground">{team.bio}</p> : null}
        </div>

        <div className="mt-10">
          <h2 className="text-sm font-semibold tracking-tight">Choose a service</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick the type of appointment you want. You&apos;ll choose a time on the next screen.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {events.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No public events yet.</p>
          ) : (
            events.map((e) => (
              <Link key={e.id} href={`/book/${slug}/${e.slug}` as Route} className="group block">
                <Card className="flex items-center justify-between p-5 transition-colors hover:border-foreground">
                  <div>
                    <h2 className="font-medium">{e.title}</h2>
                    {e.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {formatDuration(e.length)}
                      </span>
                      {e.schedulingType ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> {e.schedulingType.replace("_", " ")}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3">
                      {e.nextAvailable ? (
                        <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          Next available {formatNextAvailable(new Date(e.nextAvailable), e.scheduleTimeZone)}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-border/60 bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                          No times in the next 30 days
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="ml-4 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all group-hover:border-primary/30 group-hover:text-primary">
                    Choose time
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
      <PublicLegal />
    </main>
  );
}
