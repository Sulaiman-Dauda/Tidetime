import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata, Route } from "next";
import { getBookingByUid } from "@/server/bookings";
import { formatRange } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CancelBooking } from "./cancel";
import { CompanyBrandHeader } from "../../_components/company-brand-header";
import { PublicLegal } from "../../_components/public-legal";
import { CalendarCheck, Clock, MapPin, User, Mail, AlertCircle, CalendarClock, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";

export const metadata: Metadata = { title: "Your booking · Tidetime" };

interface Props {
  params: Promise<{ uid: string }>;
}

export default async function BookingDetailPage({ params }: Props) {
  const { uid } = await params;
  const data = await getBookingByUid(uid);
  if (!data) notFound();

  const { booking, attendees, host, slug, team, eventType } = data;
  const primary = attendees.find((a) => a.isPrimary) ?? attendees[0];
  const tz = primary?.timeZone ?? "UTC";
  const when = formatRange(booking.startTime, booking.endTime, tz);

  const cancelled = booking.status === "cancelled" || booking.status === "rejected";
  const awaitingPayment = booking.status === "pending" && Boolean(eventType?.requiresPayment) && !booking.paid;
  const pending = booking.status === "pending" && !awaitingPayment;

  const status = cancelled
    ? { icon: XCircle, label: "Cancelled", cls: "text-destructive", ring: "bg-destructive/10 text-destructive" }
    : awaitingPayment
      ? { icon: AlertCircle, label: "Awaiting payment", cls: "text-amber-600", ring: "bg-amber-500/10 text-amber-600" }
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
              <span className="text-sm font-medium text-foreground">{host.name ?? host.username}</span>
            </div>
          )}
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${status.ring}`}>
            <StatusIcon className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-center text-xl font-semibold tracking-tight">
            {cancelled
              ? "This booking was cancelled"
              : awaitingPayment
                ? "Payment still needed"
                : pending
                  ? "Booking requested"
                  : "You're booked"}
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {awaitingPayment
              ? "Your slot is reserved while payment is being completed. Once Stripe confirms it, we'll update the booking automatically."
              : pending
                ? "We've sent your request to the host. You'll be notified once it's confirmed."
                : cancelled
                  ? booking.cancellationReason ?? "This event is no longer scheduled."
                  : "A calendar invite has been sent to your email."}
          </p>

          <dl className="mt-8 space-y-4 border-t pt-6 text-sm">
            <Detail icon={CalendarCheck} label="What" value={booking.title} />
            <Detail icon={Clock} label="When" value={`${when} (${tz.replace(/_/g, " ")})`} />
            {host ? <Detail icon={User} label="Who" value={host.name ?? host.username} /> : null}
            {team ? <Detail icon={User} label="Team" value={team.name} /> : null}
            {primary ? (
              <Detail
                icon={Mail}
                label="Email"
                value={<a href={`mailto:${primary.email}`} className="text-primary hover:underline">{primary.email}</a>}
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
          </dl>

          {!cancelled ? (
            <div className="mt-8 flex flex-col gap-2 border-t pt-6 sm:flex-row">
              {rescheduleHref ? (
                <Button asChild variant="outline" className="flex-1">
                  <Link href={rescheduleHref}>
                    <CalendarClock className="h-4 w-4" /> Reschedule
                  </Link>
                </Button>
              ) : null}
              <CancelBooking uid={booking.uid} isRecurring={Boolean(booking.recurringEventId)} />
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
          <Link href="/" className="font-medium text-foreground hover:underline">
            Tidetime
          </Link>
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
