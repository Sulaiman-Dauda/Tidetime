import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  CalendarCheck,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  Clock,
  Phone,
  XCircle,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/guard";
import { db } from "@/db";
import { bookings, attendees, memberships, services, teams } from "@/db/schema";
import { can } from "@/lib/rbac";
import { listBookingActivity } from "@/server/activity";
import type { BookingActivityType } from "@/server/activity";
import { formatDuration, initials, resolveLocale } from "@/lib/format";
import { answersFromResponses } from "@/lib/booking-fields";
import { formatPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "../../_components/page-header";
import { AcceptButton, CancelBookingButton, DeclineButton } from "../_components/booking-actions";
import { BookingStatusBadge } from "../_components/booking-status-badge";

interface Props {
  params: Promise<{ uid: string }>;
}

const ACTIVITY_META: Record<
  BookingActivityType,
  { label: string; icon: typeof Clock; tone: string }
> = {
  created: { label: "Booking created", icon: CalendarCheck, tone: "text-success" },
  rescheduled: { label: "Rescheduled", icon: CalendarClock, tone: "text-warning" },
  cancelled: { label: "Cancelled", icon: CalendarX2, tone: "text-destructive" },
  confirmed: { label: "Confirmed", icon: CheckCircle2, tone: "text-success" },
  rejected: { label: "Declined", icon: XCircle, tone: "text-destructive" },
  rsvp: { label: "RSVP", icon: CheckCircle2, tone: "text-info" },
};

const RSVP_BADGES: Record<string, { label: string; variant: "success" | "secondary" | "destructive" }> = {
  accepted: { label: "Attending", variant: "success" },
  tentative: { label: "Maybe", variant: "secondary" },
  declined: { label: "Declined", variant: "destructive" },
};

export default async function BookingDetailPage({ params }: Props) {
  const { user, role, teamId } = await requireAnyPermission([
    "booking.own.view",
    "booking.all.view",
  ]);
  const { uid } = await params;

  // Authorize against the host's membership, not the service's team: a
  // booking whose service was deleted must stay visible to team viewers.
  const [booking] = await db.select().from(bookings).where(eq(bookings.uid, uid)).limit(1);
  if (!booking) notFound();
  let authorized = booking.userId === user.id;
  if (!authorized && can(role, "booking.all.view")) {
    if (booking.userId !== null) {
      const [hostMembership] = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(and(
          eq(memberships.userId, booking.userId),
          eq(memberships.teamId, teamId),
          eq(memberships.accepted, true),
        ))
        .limit(1);
      authorized = Boolean(hostMembership);
    }
    // Removed member but the service belongs to this team: still visible.
    if (!authorized && booking.serviceId !== null) {
      const [teamService] = await db
        .select({ id: services.id })
        .from(services)
        .where(and(eq(services.id, booking.serviceId), eq(services.teamId, teamId)))
        .limit(1);
      authorized = Boolean(teamService);
    }
  }
  if (!authorized) notFound();

  const [ats, activity, serviceRow] = await Promise.all([
    db.select().from(attendees).where(eq(attendees.bookingId, booking.id)),
    listBookingActivity(booking.id),
    booking.serviceId
      ? db
          .select({ bookingFields: services.bookingFields, slug: services.slug, teamId: services.teamId })
          .from(services)
          .where(eq(services.id, booking.serviceId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);
  const [teamRow] = serviceRow
    ? await db.select({ slug: teams.slug }).from(teams).where(eq(teams.id, serviceRow.teamId)).limit(1)
    : [];
  const rescheduleHref =
    teamRow && serviceRow ? `/book/${teamRow.slug}/${serviceRow.slug}?reschedule=${booking.uid}` : null;

  // Custom-question answers via the shared helper: system name/email fields are
  // excluded (they already render on the attendee rows).
  const responses = (booking.responses ?? {}) as Record<string, unknown>;
  // The primary attendee's phone is copied from the form's phone question when
  // the booking is made. It keeps its call link on the attendee row, so the
  // matching answer is dropped here rather than shown a second time.
  const primaryPhone = ats.find((a) => a.isPrimary)?.phoneNumber;
  const answers = serviceRow
    ? answersFromResponses(
        serviceRow.bookingFields,
        responses,
        primaryPhone ? formatPhoneDisplay(primaryPhone) : null,
      )
    : Object.entries(responses)
        .filter(([key, value]) => !["name", "email"].includes(key) && typeof value === "string" && value.trim())
        .map(([key, value]) => ({ label: key, value: String(value) }));
  const canCancel = booking.status === "accepted" && booking.endTime.getTime() >= Date.now();
  const locale = resolveLocale(user.locale);
  const hour12 = user.timeFormat === 12;
  const dateLabel = new Intl.DateTimeFormat(locale, {
    timeZone: user.timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(booking.startTime);
  const timeFormat = new Intl.DateTimeFormat(locale, {
    timeZone: user.timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12,
  });
  const timeLabel = `${timeFormat.format(booking.startTime)} – ${timeFormat.format(booking.endTime)}`;
  const minutes = Math.round((booking.endTime.getTime() - booking.startTime.getTime()) / 60_000);
  const activityTime = new Intl.DateTimeFormat(locale, {
    timeZone: user.timeZone,
    dateStyle: "medium",
    timeStyle: "short",
    hour12,
  });
  const expired = booking.status === "pending" && booking.endTime.getTime() < Date.now();
  const people = [...ats.filter((a) => a.isPrimary), ...ats.filter((a) => !a.isPrimary)];

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/dashboard/bookings", label: "Bookings" }}
        title={booking.title}
        meta={<BookingStatusBadge status={booking.status} expired={expired} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{people.length === 1 ? "Attendee" : "Attendees"}</CardTitle>
            </CardHeader>
            {people.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">No attendees on this booking.</p>
            ) : (
              <ul className="divide-y border-t">
                {people.map((a) => {
                  const rsvp = RSVP_BADGES[a.rsvpStatus];
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{initials(a.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                        <p className="flex flex-wrap gap-x-3 text-meta text-muted-foreground">
                          <a href={`mailto:${a.email}`} className="truncate hover:text-foreground hover:underline">
                            {a.email}
                          </a>
                          {/* Dial the raw E.164; show it grouped for reading. */}
                          {a.phoneNumber ? (
                            <a
                              href={`tel:${a.phoneNumber}`}
                              className="inline-flex items-center gap-1 tabular-nums hover:text-foreground hover:underline"
                            >
                              <Phone className="size-3" aria-hidden />
                              {formatPhoneDisplay(a.phoneNumber)}
                            </a>
                          ) : null}
                        </p>
                      </div>
                      {rsvp ? <Badge variant={rsvp.variant}>{rsvp.label}</Badge> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Booking answers</CardTitle>
            </CardHeader>
            {answers.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">No extra answers were submitted.</p>
            ) : (
              <dl className="divide-y border-t">
                {answers.map((answer) => (
                  <div key={answer.label} className="grid gap-1 px-5 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
                    <dt className="text-sm text-muted-foreground">{answer.label}</dt>
                    <dd className="whitespace-pre-line break-words text-sm text-foreground">{answer.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            {activity.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ol className="px-5 pb-5">
                {activity.map((entry, index) => {
                  const meta = ACTIVITY_META[entry.type as BookingActivityType] ?? {
                    label: entry.type,
                    icon: Clock,
                    tone: "text-muted-foreground",
                  };
                  const Icon = meta.icon;
                  return (
                    <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {index < activity.length - 1 ? (
                        <span className="absolute bottom-0 left-3 top-7 w-px bg-border" aria-hidden />
                      ) : null}
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-card">
                        <Icon className={cn("size-3.5", meta.tone)} aria-hidden />
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-sm font-medium text-foreground">{meta.label}</p>
                        {entry.message ? (
                          <p className="text-meta text-muted-foreground">{entry.message}</p>
                        ) : null}
                        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                          {activityTime.format(new Date(entry.createdAt))}
                          {entry.actor ? ` · ${entry.actor}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        {/* First on phones: the time and the actions are what you open a booking for. */}
        <aside className="order-first lg:order-none">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <dl className="space-y-3 px-5 pb-5 text-sm">
              <SummaryRow label="Date">{dateLabel}</SummaryRow>
              <SummaryRow label="Time">
                <span className="tabular-nums">{timeLabel}</span>
              </SummaryRow>
              <SummaryRow label="Duration">{formatDuration(minutes)}</SummaryRow>
              {booking.location ? (
                <SummaryRow label="Location">
                  {booking.meetingUrl ? (
                    <a
                      href={booking.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {booking.location}
                    </a>
                  ) : (
                    booking.location
                  )}
                </SummaryRow>
              ) : null}
              {booking.cancellationReason ? (
                <SummaryRow label="Reason">{booking.cancellationReason}</SummaryRow>
              ) : null}
            </dl>

            {booking.status === "pending" ? (
              <div className="space-y-3 border-t p-5">
                <p className="text-meta text-muted-foreground">This request is waiting for your decision.</p>
                <div className="grid grid-cols-2 gap-2">
                  <DeclineButton uid={booking.uid} />
                  <AcceptButton uid={booking.uid} />
                </div>
              </div>
            ) : canCancel ? (
              <div className="grid grid-cols-2 gap-2 border-t p-5">
                {rescheduleHref ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={rescheduleHref}>
                      <CalendarClock />
                      Reschedule
                    </a>
                  </Button>
                ) : null}
                <CancelBookingButton uid={booking.uid} className={rescheduleHref ? undefined : "col-span-2"} />
              </div>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words text-foreground">{children}</dd>
    </div>
  );
}
