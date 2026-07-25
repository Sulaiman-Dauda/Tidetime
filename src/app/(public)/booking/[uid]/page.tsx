import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata, Route } from "next";
import { getBookingByUid } from "@/server/bookings";
import { formatRange } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CancelBooking } from "./cancel";
import { CompanyBrandHeader } from "../../_components/company-brand-header";
import { PublicLegal } from "../../_components/public-legal";
import { CalendarCheck, Clock, MapPin, Users, AlertCircle, CalendarClock, XCircle, MessageSquare, Phone, CalendarPlus, Download, RotateCcw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { answersFromResponses } from "@/lib/booking-fields";
import { formatPhoneDisplay } from "@/lib/phone";
import { SuccessBurst } from "./success-burst";

export const metadata: Metadata = { title: "Your booking · Tidetime" };

interface Props {
  params: Promise<{ uid: string }>;
  searchParams: Promise<{ rsvp?: string; rsvp_error?: string; confirmed?: string }>;
}

/** UTC basic format (YYYYMMDDTHHMMSSZ) for Google Calendar template links. */
function calendarStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

const RSVP_LABELS: Record<string, string> = {
  accepted: "Thanks — you're marked as attending.",
  declined: "Got it — you've declined this invitation.",
  tentative: "Noted — you're marked as a maybe.",
};

export default async function BookingDetailPage({ params, searchParams }: Props) {
  const { uid } = await params;
  const { rsvp, rsvp_error, confirmed } = await searchParams;
  const data = await getBookingByUid(uid);
  if (!data) notFound();

  const { booking, attendees, host, slug, team, service } = data;
  const primary = attendees.find((a) => a.isPrimary) ?? attendees[0];
  const tz = primary?.timeZone ?? "UTC";
  const when = formatRange(booking.startTime, booking.endTime, tz);
  const answers = answersFromResponses(
    service?.bookingFields ?? [],
    (booking.responses ?? {}) as Record<string, unknown>,
    booking.description,
  );

  const cancelled = booking.status === "cancelled" || booking.status === "rejected";
  const pending = booking.status === "pending";
  const justBooked = confirmed === "1" && !cancelled;

  // Add-to-calendar links (accepted bookings only — no invites for requests
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
    ? { icon: XCircle, label: "Cancelled", cls: "text-destructive", ring: "bg-destructive/10 text-destructive" }
    : pending
        ? { icon: AlertCircle, label: "Awaiting confirmation", cls: "text-amber-600", ring: "bg-amber-500/10 text-amber-600" }
        : { icon: CalendarCheck, label: "Confirmed", cls: "text-emerald-600", ring: "bg-emerald-500/10 text-emerald-600" };

  const StatusIcon = status.icon;
  const rescheduleHref = team && slug
    ? (`/book/${team.slug}/${slug}?reschedule=${booking.uid}` as Route)
    : host && slug
      ? (`/${host.username}/${slug}?reschedule=${booking.uid}` as Route)
      : null;

  return (
    <main className="min-h-screen bg-grid">
      <CompanyBrandHeader />
      <div className="mx-auto flex max-w-lg flex-col px-4 py-16">
        {rsvp && RSVP_LABELS[rsvp] ? (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700">
            {RSVP_LABELS[rsvp]}
          </div>
        ) : null}
        {rsvp_error ? (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            We couldn&apos;t record your response — the link may have expired.
          </div>
        ) : null}
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          {/* Host info */}
          {host && (
            <div className="flex items-center justify-center gap-3 mb-5">
              <Avatar className="h-10 w-10 ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
                {host.avatarUrl && <AvatarImage src={host.avatarUrl} alt="" />}
                <AvatarFallback className="text-xs font-semibold bg-primary/15 text-primary">
                  {initials(host.name ?? host.username)}
                </AvatarFallback>
              </Avatar>
              <span className="text-left">
                <span className="block text-sm font-medium text-foreground">{host.name ?? host.username}</span>
                {host.position ? (
                  <span className="block text-xs text-muted-foreground">{host.position}</span>
                ) : null}
              </span>
            </div>
          )}
          <div className="relative mx-auto h-14 w-14">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full ${status.ring}`}
              style={justBooked ? { animation: "tt-pop 500ms ease-out both" } : undefined}
            >
              <StatusIcon className="h-7 w-7" />
            </div>
            {justBooked ? <SuccessBurst /> : null}
          </div>
          <h1 className="mt-5 text-center text-xl font-semibold tracking-tight">
            {cancelled
              ? "This booking was cancelled"
              : pending
                  ? "Booking requested"
                  : "You're booked"}
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {pending
                ? "We've sent your request to the host — most requests are answered within a day. You'll get an email whether it's confirmed or not, and your calendar invite arrives with the confirmation."
                : cancelled
                  ? booking.cancellationReason ?? "This event is no longer scheduled."
                  : "A calendar invite has been sent to your email."}
          </p>

          <dl className="mt-8 space-y-4 border-t pt-6 text-sm">
            <Detail icon={CalendarCheck} label="What" value={service?.title ?? booking.title} />
            <Detail icon={Clock} label="When" value={`${when} (${tz.replace(/_/g, " ")})`} />
            {host || primary ? (
              <Detail
                icon={Users}
                label="Who"
                value={
                  <span className="space-y-0.5">
                    {host ? (
                      <span className="block">
                        {host.name ?? host.username}{" "}
                        <span className="font-normal text-muted-foreground">· Host{team ? `, ${team.name}` : ""}</span>
                      </span>
                    ) : null}
                    {primary ? (
                      <span className="block">
                        {primary.name}{" "}
                        <span className="font-normal text-muted-foreground">
                          · <a href={`mailto:${primary.email}`} className="hover:underline">{primary.email}</a>
                        </span>
                      </span>
                    ) : null}
                  </span>
                }
              />
            ) : null}
            <Detail
              icon={MapPin}
              label="Where"
              value={
                booking.meetingUrl ? (
                  <a href={booking.meetingUrl} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                    {booking.location ?? "Join meeting"}
                  </a>
                ) : (
                  booking.location ?? "—"
                )
              }
            />
            {primary?.phoneNumber ? (
              <Detail icon={Phone} label="Phone" value={formatPhoneDisplay(primary.phoneNumber)} />
            ) : null}
            {booking.description ? (
              <Detail icon={MessageSquare} label="Notes" value={booking.description} />
            ) : null}
            {answers.map((answer) => (
              <Detail key={answer.label} icon={MessageSquare} label={answer.label} value={answer.value} />
            ))}
          </dl>

          {!cancelled && !pending ? (
            <div className="mt-8 border-t pt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Add to calendar
              </p>
              <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <a href={googleUrl} target="_blank" rel="noopener noreferrer">
                    <CalendarPlus className="h-4 w-4" /> Google
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <a href={outlookUrl} target="_blank" rel="noopener noreferrer">
                    <CalendarPlus className="h-4 w-4" /> Outlook
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <a href={`/booking/${booking.uid}/ics`} download>
                    <Download className="h-4 w-4" /> .ics file
                  </a>
                </Button>
              </div>
            </div>
          ) : null}

          {!cancelled ? (
            <div className="mt-6 flex flex-col gap-2 border-t pt-6 sm:flex-row">
              {rescheduleHref ? (
                <Button asChild variant="outline" className="flex-1">
                  <Link href={rescheduleHref}>
                    <CalendarClock className="h-4 w-4" /> Reschedule
                  </Link>
                </Button>
              ) : null}
              <CancelBooking uid={booking.uid} />
            </div>
          ) : team && slug ? (
            <div className="mt-8 border-t pt-6">
              <Button asChild className="w-full">
                <Link href={`/book/${team.slug}/${slug}` as Route}>
                  <RotateCcw className="h-4 w-4" /> Book again
                </Link>
              </Button>
            </div>
          ) : null}

          {!cancelled ? (
            <div className="mt-6 rounded-xl border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              Need to make a change? Use the buttons above. Your latest manage link also stays in your confirmation email.
            </div>
          ) : null}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
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

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 font-medium">{value}</dd>
      </div>
    </div>
  );
}
