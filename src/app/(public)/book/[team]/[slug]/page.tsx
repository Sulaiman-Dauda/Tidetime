import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { getTeamService, getTeamHosts } from "@/server/teams-public";
import { getCompanySettings } from "@/server/company-settings";
import { issueBotChallenge } from "@/lib/bot-challenge";
import { env } from "@/lib/env";
import { BookingFlow } from "../../../_components/booking-flow";
import { PublicLegal } from "../../../_components/public-legal";
import { CompanyBrandHeader } from "../../../_components/company-brand-header";

interface Props {
  params: Promise<{ team: string; slug: string }>;
  searchParams: Promise<{
    reschedule?: string;
  }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team, slug } = await params;
  const data = await getTeamService(team, slug);
  if (!data) return { title: "Not found" };
  return {
    title: `${data.service.title} · ${data.team.name}`,
    description: data.service.description ?? `Book ${data.service.title} with ${data.team.name}.`,
  };
}

export default async function TeamBookingPage({ params, searchParams }: Props) {
  const { team, slug } = await params;
  const { reschedule } = await searchParams;
  const [data, settings] = await Promise.all([
    getTeamService(team, slug),
    getCompanySettings(),
  ]);
  if (!data) notFound();

  const { team: teamRow, service } = data;
  const disabled = settings.booking.bookingDisabled;
  const teamHosts = await getTeamHosts(service.id);

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
      <BookingFlow
        slug={slug}
        teamSlug={teamRow.slug}
        rescheduleUid={reschedule}
        service={{
          id: service.id,
          title: service.title,
          description: service.description,
          length: service.length,
          durations: service.durations,
          locations: service.locations,
          bookingFields: service.bookingFields,
          requiresConfirmation: service.requiresConfirmation,
          disableGuests: service.disableGuests,
          scheduleTimeZone: service.scheduleTimeZone,
        }}
        host={{ name: teamRow.name, username: teamRow.slug, avatarUrl: teamRow.logoUrl }}
        spamProtection={settings.booking.spamProtectionEnabled}
        botChallenge={issueBotChallenge(env.authSecret)}
        teamHosts={teamHosts}
      />
      <PublicLegal />
    </main>
  );
}
