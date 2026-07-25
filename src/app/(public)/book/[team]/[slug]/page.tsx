import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { getTeamService, getTeamHosts } from "@/server/teams-public";
import { getBookingByUid } from "@/server/bookings";
import { getCompanySettings } from "@/server/company-settings";
import { issueBotChallenge, botChallengeSecret } from "@/lib/bot-challenge";
import type { FieldValues } from "@/lib/booking-fields";
import { formatDuration } from "@/lib/format";
import { BookingFlow, type BookingPrefill, type LegalLink } from "../../../_components/booking-flow";
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
  const title = `${data.service.title} · ${data.team.name}`;
  const description =
    data.service.description ??
    `Book ${data.service.title} (${formatDuration(data.service.length)}) with ${data.team.name}.`;
  // Open Graph/Twitter cards make shared booking links render professionally
  // in chat apps and social feeds.
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: data.team.name,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
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

  // Same visibility rules as the PublicLegal footer.
  const legalLinks: LegalLink[] = [];
  if (settings.legal.termsEnabled && settings.legal.termsContent.trim()) {
    legalLinks.push({ label: "Terms & Conditions", href: "/legal/terms", external: false });
  }
  if (settings.legal.privacyEnabled && settings.legal.privacyContent.trim()) {
    legalLinks.push({ label: "Privacy Policy", href: "/legal/privacy", external: false });
  }

  // On reschedule, prefill the booker's existing details so they don't re-enter
  // them. Only trust the stored booking when it belongs to this same service and
  // is still active — otherwise the reschedule would be rejected anyway.
  let prefill: BookingPrefill | undefined;
  if (reschedule) {
    const existing = await getBookingByUid(reschedule);
    if (
      existing &&
      existing.booking.serviceId === service.id &&
      (existing.booking.status === "accepted" || existing.booking.status === "pending")
    ) {
      const primary =
        existing.attendees.find((a) => a.isPrimary) ?? existing.attendees[0];
      if (primary) {
        prefill = {
          name: primary.name,
          email: primary.email,
          responses: (existing.booking.responses ?? {}) as FieldValues,
          guests: existing.attendees
            .filter((a) => !a.isPrimary)
            .map((a) => a.email),
        };
      }
    }
  }

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
      {/* Accent bar only — the sidebar below carries the logo and company name. */}
      <CompanyBrandHeader accentOnly />
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
        // Teams rarely carry their own logo in the single-company model, so
        // fall back to the company profile logo from Settings → General.
        // Without this the sidebar showed initials while the page header
        // showed the real logo.
        company={{
          name: teamRow.name,
          logoUrl: teamRow.logoUrl || settings.profile.logoUrl || null,
        }}
        spamProtection={settings.booking.spamProtectionEnabled}
        botChallenge={issueBotChallenge(botChallengeSecret())}
        teamHosts={teamHosts}
        prefill={prefill}
        legalLinks={legalLinks}
        phoneCountry={settings.profile.phoneCountry}
      />
      <PublicLegal />
    </main>
  );
}
