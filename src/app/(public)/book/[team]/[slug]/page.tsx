import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTeamEventType } from "@/server/teams-public";
import { BookingFlow } from "../../../[username]/[slug]/booking-flow";

interface Props {
  params: Promise<{ team: string; slug: string }>;
  searchParams: Promise<{ embed?: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team, slug } = await params;
  const data = await getTeamEventType(team, slug);
  if (!data) return { title: "Not found" };
  return {
    title: `${data.eventType.title} · ${data.team.name}`,
    description: data.eventType.description ?? `Book ${data.eventType.title} with ${data.team.name}.`,
  };
}

export default async function TeamBookingPage({ params, searchParams }: Props) {
  const { team, slug } = await params;
  const { embed } = await searchParams;
  const data = await getTeamEventType(team, slug);
  if (!data) notFound();

  const { team: teamRow, eventType } = data;
  const isEmbed = embed === "1";

  return (
    <main className={isEmbed ? "min-h-screen bg-background" : "min-h-screen bg-grid"}>
      <BookingFlow
        username={teamRow.slug}
        slug={slug}
        teamSlug={teamRow.slug}
        embed={isEmbed}
        eventType={{
          id: eventType.id,
          title: eventType.title,
          description: eventType.description,
          length: eventType.length,
          durations: eventType.durations,
          locations: eventType.locations,
          bookingFields: eventType.bookingFields,
          requiresConfirmation: eventType.requiresConfirmation,
          disableGuests: eventType.disableGuests,
          scheduleTimeZone: eventType.scheduleTimeZone,
          price: eventType.price,
          currency: eventType.currency,
        }}
        host={{ name: teamRow.name, username: teamRow.slug, avatarUrl: teamRow.logoUrl }}
      />
    </main>
  );
}
