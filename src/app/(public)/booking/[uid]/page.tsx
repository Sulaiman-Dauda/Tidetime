import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata, Route } from "next";
import { ArrowUpRight, Check, Clock, X } from "lucide-react";
import { getBookingByUid } from "@/server/bookings";
import { formatRange } from "@/lib/format";
import { answersFromResponses } from "@/lib/booking-fields";
import { formatPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CancelBooking } from "./cancel";
import { CompanyBrandHeader } from "../../_components/company-brand-header";
import { PublicLegal } from "../../_components/public-legal";

export const metadata: Metadata = { title: "Your booking" };

interface Props {
  params: Promise<{ uid: string }>;
  searchParams: Promise<{ rsvp?: string; rsvp_error?: string }>;
}

/** UTC basic format (YYYYMMDDTHHMMSSZ) for Google Calendar template links. */
function calendarStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

const RSVP_LABELS: Record<string, string> = {
  accepted: "Thanks, you're marked as attending.",
  declined: "Got it, you've declined this invitation.",
  tentative: "Noted, you're marked as a maybe.",
};

export default async function BookingDetailPage({ params, searchParams }: Props) {
  const { uid } = await params;
  const { rsvp, rsvp_error } = await searchParams;
  const data = await getBookingByUid(uid);
  if (!data) notFound();

  const { booking, attendees, host, slug, team, service } = data;
  const primary = attendees.find((a) => a.isPrimary) ?? attendees[0];
  const tz = primary?.timeZone ?? "UTC";
  const when = formatRange(booking.startTime, booking.endTime, tz);
  const fields = service?.bookingFields ?? [];
  const responses = (booking.responses ?? {}) as Record<string, unknown>;
  const answers = answersFromResponses(fields, responses, booking.description);

  // The attendee's phone number is copied from the form's phone question when
  // the booking is made, so that answer already shows it. The stored number
  // only needs its own row when the answer is missing (the question was
  // removed from the service later, for example).
  const phoneAnswered = fields.some((field) => {
    const value = responses[field.name];
    return !field.system && field.type === "phone" && typeof value === "string" && value.trim() !== "";
  });
  const phone = primary?.phoneNumber && !phoneAnswered ? formatPhoneDisplay(primary.phoneNumber) : null;

  const cancelled = booking.status === "cancelled" || booking.status === "rejected";
  const pending = booking.status === "pending";

  // Add-to-calendar links (accepted bookings only, no invites for requests
  // that may still be declined).
  const calTitle = service?.title ?? booking.title;
  const calDetails = [
    booking.meetingUrl ? `Join: ${booking.meetingUrl}` : null,
    booking.description ? `Notes: ${booking.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const calLocation = booking.meetingUrl ?? booking.location ?? "";
  const googleUrl = `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: calTitle,
    dates: `${calendarStamp(booking.startTime)}/${calendarStamp(booking.endTime)}`,
    details: calDetails,
    location: calLocation,
  })}`;
  const outlookUrl = `https://outlook.live.com/calendar/0/action/compose?${new URLSearchParams({
    rru: "addevent",
    subject: calTitle,
    startdt: booking.startTime.toISOString(),
    enddt: booking.endTime.toISOString(),
    body: calDetails,
    location: calLocation,
  })}`;

  const status = cancelled
    ? {
        icon: X,
        tone: "bg-destructive-subtle text-destructive",
        title: "This booking was cancelled",
        message: booking.cancellationReason ?? "This event is no longer scheduled.",
      }
    : pending
      ? {
          icon: Clock,
          tone: "bg-warning-subtle text-warning",
          title: "Booking requested",
          message:
            "We've sent your request to the host. You'll get an email once it's confirmed or declined, and your calendar invite comes with the confirmation.",
        }
      : {
          icon: Check,
          tone: "bg-accent text-accent-foreground",
          title: "You're booked",
          message: "A calendar invite has been sent to your email.",
        };
  const StatusIcon = status.icon;

  const rescheduleHref = team && slug
    ? (`/book/${team.slug}/${slug}?reschedule=${booking.uid}` as Route)
    : host && slug
      ? (`/${host.username}/${slug}?reschedule=${booking.uid}` as Route)
      : null;

  return (
    <main className="flex min-h-screen flex-col bg-canvas">
      <CompanyBrandHeader />
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:py-14">
        {rsvp && RSVP_LABELS[rsvp] ? (
          <p className="mb-4 rounded-xl bg-success-subtle px-4 py-3 text-sm font-medium text-success">
            {RSVP_LABELS[rsvp]}
          </p>
        ) : null}
        {rsvp_error ? (
          <p className="mb-4 rounded-xl bg-destructive-subtle px-4 py-3 text-sm font-medium text-destructive">
            We couldn&apos;t record your response. The link may have expired.
          </p>
        ) : null}

        <div className="rounded-2xl bg-card text-card-foreground shadow-popover">
          <header className="px-6 pb-6 pt-8 text-center sm:px-8">
            <span className={cn("mx-auto flex size-11 items-center justify-center rounded-full", status.tone)}>
              <StatusIcon className="size-5" strokeWidth={2.5} aria-hidden />
            </span>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">{status.title}</h1>
            <p className="mx-auto mt-1.5 max-w-sm text-pretty text-sm text-muted-foreground">{status.message}</p>
          </header>

          <Section>
            <dl className="space-y-4 sm:space-y-3">
              <Row label="What">
                <span className="font-medium">{service?.title ?? booking.title}</span>
              </Row>
              <Row label="When">
                <span className="tabular-nums">{when}</span>
                <span className="block text-muted-foreground">{tz.replace(/_/g, " ")}</span>
              </Row>
              {host || primary ? (
                <Row label="Who">
                  <span className="block space-y-2">
                    {host ? (
                      <span className="block">
                        {host.name ?? host.username}
                        <span className="block text-muted-foreground">Host{team ? `, ${team.name}` : ""}</span>
                      </span>
                    ) : null}
                    {primary ? (
                      <span className="block">
                        {primary.name}
                        <a
                          href={`mailto:${primary.email}`}
                          className="block text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {primary.email}
                        </a>
                      </span>
                    ) : null}
                  </span>
                </Row>
              ) : null}
              {booking.meetingUrl && !cancelled ? (
                <Row label="Where">
                  <a
                    href={booking.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    {booking.location ?? "Join meeting"}
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </a>
                </Row>
              ) : booking.location ? (
                <Row label="Where">{booking.location}</Row>
              ) : null}
            </dl>
          </Section>

          {phone || booking.description || answers.length > 0 ? (
            <Section>
              <dl className="space-y-4 sm:space-y-3">
                {phone ? <Row label="Phone">{phone}</Row> : null}
                {booking.description ? (
                  <Row label="Notes">
                    <span className="whitespace-pre-line">{booking.description}</span>
                  </Row>
                ) : null}
                {answers.map((answer) => (
                  <Row key={answer.label} label={answer.label}>
                    <span className="whitespace-pre-line">{answer.value}</span>
                  </Row>
                ))}
              </dl>
            </Section>
          ) : null}

          {!cancelled && !pending ? (
            <Section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-medium">Add to calendar</h2>
              <div className="flex -space-x-px">
                <CalendarButton href={googleUrl} external>
                  Google
                </CalendarButton>
                <CalendarButton href={outlookUrl} external>
                  Outlook
                </CalendarButton>
                <CalendarButton href={`/booking/${booking.uid}/ics`}>.ics file</CalendarButton>
              </div>
            </Section>
          ) : null}

          {!cancelled ? (
            <Section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-medium">Need to make a change?</h2>
                <p className="text-meta text-muted-foreground">This link is also in your email.</p>
              </div>
              <div className="flex gap-2">
                {rescheduleHref ? (
                  <Button asChild variant="outline" className="flex-1 sm:flex-none">
                    <Link href={rescheduleHref}>Reschedule</Link>
                  </Button>
                ) : null}
                <CancelBooking uid={booking.uid} />
              </div>
            </Section>
          ) : team && slug ? (
            <Section>
              <Button asChild className="w-full">
                <Link href={`/book/${team.slug}/${slug}` as Route}>Book again</Link>
              </Button>
            </Section>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by{" "}
          <a
            href="https://tidetime.app"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:underline"
          >
            Tidetime
          </a>
        </p>
      </div>
      <PublicLegal />
    </main>
  );
}

function Section({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("border-t px-6 py-5 sm:px-8", className)}>{children}</div>;
}

/** One label/value pair: stacked on phones, a fixed label column from sm up. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 text-sm sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** One segment of the joined add-to-calendar button group. */
function CalendarButton({
  href,
  external = false,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      asChild
      variant="outline"
      className="flex-1 rounded-none first:rounded-l-lg last:rounded-r-lg focus-visible:z-10 sm:flex-none"
    >
      <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : { download: true })}>
        {children}
      </a>
    </Button>
  );
}
