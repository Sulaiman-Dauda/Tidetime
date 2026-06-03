import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { getPublicTeam, getTeamEventTypes } from "@/server/teams-public";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { initials } from "@/lib/format";
import { formatDuration } from "@/lib/format";
import { Clock, Users } from "lucide-react";
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

  const events = await getTeamEventTypes(team.id);

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

        <div className="mt-10 space-y-3">
          {events.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No public events yet.</p>
          ) : (
            events.map((e) => (
              <Link key={e.id} href={`/book/${slug}/${e.slug}` as Route}>
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
                  </div>
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
