import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicEventType } from "@/server/availability";
import { isBookingDisabled } from "@/server/company-settings";
import { getStripeConfig } from "@/server/settings";
import { BookingFlow } from "./booking-flow";
import { PublicLegal } from "../../_components/public-legal";
import { CompanyBrandHeader } from "../../_components/company-brand-header";
import { AlertTriangle } from "lucide-react";

interface Props {
  params: Promise<{ username: string; slug: string }>;
  searchParams: Promise<{
    reschedule?: string;
    month?: string;
    embed?: string;
    link?: string;
    booking?: string;
    payment_intent?: string;
  }>;
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
  const { reschedule, embed, link, booking, payment_intent: paymentIntentId } = await searchParams;
  const [data, stripeConfig] = await Promise.all([
    getPublicEventType(username, slug),
    getStripeConfig(),
  ]);
  if (!data || data.eventType.hidden) notFound();

  const { eventType, host } = data;
  const isEmbed = embed === "1";
  const disabled = await isBookingDisabled();

  if (disabled) {
    return (
      <main className={isEmbed ? "min-h-screen bg-background" : "min-h-screen bg-grid"}>
        {isEmbed ? null : <CompanyBrandHeader />}
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
        {isEmbed ? null : <PublicLegal />}
      </main>
    );
  }

  return (
    <main className={isEmbed ? "min-h-screen bg-background" : "min-h-screen bg-grid"}>
      {isEmbed ? null : <CompanyBrandHeader />}
      <BookingFlow
        username={username}
        slug={slug}
        rescheduleUid={reschedule}
        bookingLinkToken={link}
        embed={isEmbed}
        stripePublishableKey={stripeConfig?.publishableKey ?? null}
        paymentReturnBookingUid={booking}
        paymentReturnIntentId={paymentIntentId}
        eventType={{
          id: eventType.id,
          title: eventType.title,
          description: eventType.description,
          length: eventType.length,
          durations: eventType.durations,
          locations: eventType.locations,
          bookingFields: eventType.bookingFields,
          requiresConfirmation: eventType.requiresConfirmation,
          requiresPayment: eventType.requiresPayment,
          disableGuests: eventType.disableGuests,
          scheduleTimeZone: eventType.scheduleTimeZone,
          price: eventType.price,
          currency: eventType.currency,
          successRedirectUrl: eventType.successRedirectUrl,
          recurringEvent: eventType.recurringEvent,
        }}
        host={{ name: host.name, username: host.username, avatarUrl: host.avatarUrl }}
      />
      {isEmbed ? null : <PublicLegal />}
    </main>
  );
}
