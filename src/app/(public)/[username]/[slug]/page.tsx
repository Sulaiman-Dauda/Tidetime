import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicEventType } from "@/server/availability";
import { BookingFlow } from "./booking-flow";
import { PublicLegal } from "../../_components/public-legal";
import { CompanyBrandHeader } from "../../_components/company-brand-header";

interface Props {
  params: Promise<{ username: string; slug: string }>;
  searchParams: Promise<{ reschedule?: string; month?: string; embed?: string; link?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params;
  const data = await getPublicEventType(username, slug);
  if (!data) return { title: "Not found" };
  const host = data.host.name ?? data.host.username;
  return {
    title: `${data.eventType.title} · ${host}`,
    description: data.eventType.description ?? `Book ${data.eventType.title} with ${host}.`,
  };
}

export default async function BookingPage({ params, searchParams }: Props) {
  const { username, slug } = await params;
  const { reschedule, embed, link } = await searchParams;
  const data = await getPublicEventType(username, slug);
  if (!data || data.eventType.hidden) notFound();

  const { eventType, host } = data;
  const isEmbed = embed === "1";

  return (
    <main className={isEmbed ? "min-h-screen bg-background" : "min-h-screen bg-grid"}>
      {isEmbed ? null : <CompanyBrandHeader />}
      <BookingFlow
        username={username}
        slug={slug}
        rescheduleUid={reschedule}
        bookingLinkToken={link}
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
          recurringEvent: eventType.recurringEvent,
        }}
        host={{ name: host.name, username: host.username, avatarUrl: host.avatarUrl }}
      />
      {isEmbed ? null : <PublicLegal />}
    </main>
  );
}
