import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { getTeamEventType, getTeamHosts } from "@/server/teams-public";
import { getCompanySettings } from "@/server/company-settings";
import { getStripeConfig } from "@/server/settings";
import { issueBotChallenge } from "@/lib/bot-challenge";
import { env } from "@/lib/env";
import { BookingFlow } from "../../../[username]/[slug]/booking-flow";
import { PublicLegal } from "../../../_components/public-legal";
import { CompanyBrandHeader } from "../../../_components/company-brand-header";
import { EmbedBridge } from "../../../embed-bridge";

interface Props {
  params: Promise<{ team: string; slug: string }>;
  searchParams: Promise<{
    embed?: string;
    reschedule?: string;
    booking?: string;
    payment_intent?: string;
  }>;
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
  const { embed, reschedule, booking, payment_intent: paymentIntentId } = await searchParams;
  const [data, settings, stripeConfig] = await Promise.all([
    getTeamEventType(team, slug),
    getCompanySettings(),
    getStripeConfig(),
  ]);
  if (!data) notFound();

  const { team: teamRow, eventType } = data;
  const isEmbed = embed === "1";
  const disabled = settings.booking.bookingDisabled;
  // Let bookers pick a provider on rotating team services ("any available" stays default).
  const allowsHostPick =
    eventType.schedulingType === "round_robin" || eventType.schedulingType === "managed";
  const teamHosts = allowsHostPick ? await getTeamHosts(eventType.id) : [];

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
        username={teamRow.slug}
        slug={slug}
        teamSlug={teamRow.slug}
        rescheduleUid={reschedule}
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
        }}
        host={{ name: teamRow.name, username: teamRow.slug, avatarUrl: teamRow.logoUrl }}
        spamProtection={settings.booking.spamProtectionEnabled}
        botChallenge={issueBotChallenge(env.authSecret)}
        teamHosts={teamHosts}
      />
      {isEmbed ? <EmbedBridge /> : <PublicLegal />}
    </main>
  );
}
