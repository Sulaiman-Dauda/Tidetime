import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/guard";
import { db } from "@/db";
import { bookings, attendees, memberships, services, teams } from "@/db/schema";
import { can } from "@/lib/rbac";
import { listBookingActivity } from "@/server/activity";
import type { BookingActivityType } from "@/server/activity";
import { formatRange, resolveLocale } from "@/lib/format";
import { answersFromResponses } from "@/lib/booking-fields";
import { Badge } from "@/components/ui/badge";
import { AcceptButton, CancelBookingButton, DeclineButton } from "../_components/booking-actions";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  User,
  XCircle,
} from "lucide-react";

interface Props {
  params: Promise<{ uid: string }>;
}

const ACTIVITY_META: Record<
  BookingActivityType,
  { label: string; icon: typeof Clock; tone: string }
> = {
  created: { label: "Booking created", icon: CalendarCheck, tone: "text-emerald-500" },
  rescheduled: { label: "Rescheduled", icon: CalendarClock, tone: "text-amber-500" },
  cancelled: { label: "Cancelled", icon: CalendarX2, tone: "text-destructive" },
  confirmed: { label: "Confirmed", icon: CheckCircle2, tone: "text-emerald-500" },
  rejected: { label: "Declined", icon: XCircle, tone: "text-destructive" },
  rsvp: { label: "RSVP", icon: CheckCircle2, tone: "text-sky-500" },
};

const RSVP_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  accepted: { label: "Attending", variant: "default" },
  tentative: { label: "Maybe", variant: "secondary" },
  declined: { label: "Declined", variant: "destructive" },
};

export default async function BookingDetailPage({ params }: Props) {
  const { user, role, teamId } = await requireAnyPermission([
    "booking.own.view",
    "booking.all.view",
  ]);
  const { uid } = await params;

  // Authorize against the host's membership, not the service's team — a
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
    // Removed member but the service belongs to this team — still visible.
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

  const when = formatRange(booking.startTime, booking.endTime, user.timeZone, user.timeFormat === 12, user.locale);
  // Custom-question answers via the shared helper: system name/email fields are
  // excluded (they already render on the attendee rows above).
  const answers = serviceRow
    ? answersFromResponses(serviceRow.bookingFields, (booking.responses ?? {}) as Record<string, unknown>)
    : Object.entries(booking.responses ?? {})
        .filter(([key, value]) => !["name", "email"].includes(key) && typeof value === "string" && value.trim())
        .map(([key, value]) => ({ label: key, value: String(value) }));
  const canCancel = booking.status === "accepted" && booking.endTime.getTime() >= Date.now();
  const activityTime = new Intl.DateTimeFormat(resolveLocale(user.locale), {
    timeZone: user.timeZone,
    dateStyle: "medium",
    timeStyle: "short",
    hour12: user.timeFormat === 12,
  });

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <Link
          href="/dashboard/bookings"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to bookings
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{booking.title}</h1>
          {booking.status === "pending" && (
            <Badge variant="pending">Pending</Badge>
          )}
          {booking.status === "accepted" && <Badge>Confirmed</Badge>}
          {booking.status === "cancelled" && <Badge variant="destructive">Cancelled</Badge>}
          {booking.status === "rejected" && <Badge variant="destructive">Rejected</Badge>}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section className="space-y-6 rounded-2xl border border-border/60 bg-card p-5">
          <div>
            <h2 className="text-sm font-medium text-foreground">Details</h2>
            <dl className="mt-4 space-y-3 text-[13px]">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span className="text-foreground">{when}</span>
              </div>
              {booking.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {booking.meetingUrl ? (
                    <a
                      href={booking.meetingUrl}
                      className="text-foreground hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {booking.location}
                    </a>
                  ) : (
                    <span className="text-foreground">{booking.location}</span>
                  )}
                </div>
              )}
              {ats.map((a) => {
                const rsvp = a.rsvpStatus ? RSVP_BADGES[a.rsvpStatus] : null;
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-foreground">{a.name}</span>
                    <a href={`mailto:${a.email}`} className="hover:underline">
                      {a.email}
                    </a>
                    {a.phoneNumber ? (
                      <a href={`tel:${a.phoneNumber}`} className="flex items-center gap-1 hover:underline">
                        <Phone className="h-3 w-3" />
                        {a.phoneNumber}
                      </a>
                    ) : null}
                    {rsvp ? (
                      <Badge variant={rsvp.variant} className="text-[10px]">{rsvp.label}</Badge>
                    ) : null}
                  </div>
                );
              })}
            </dl>
          </div>

          <div className="border-t border-border/60 pt-5">
            <h2 className="text-sm font-medium text-foreground">Booking answers</h2>
            {answers.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">No extra answers were submitted.</p>
            ) : (
              <dl className="mt-4 space-y-3 text-[13px]">
                {answers.map((answer) => (
                  <div key={answer.label} className="grid gap-1 sm:grid-cols-[140px_1fr]">
                    <dt className="text-muted-foreground">{answer.label}</dt>
                    <dd className="text-foreground">{answer.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5">
          {booking.status === "pending" ? (
            <div className="space-y-3 border-b border-border/60 pb-4">
              <h2 className="text-sm font-medium text-foreground">Actions</h2>
              <div className="flex flex-wrap gap-2">
                <DeclineButton uid={booking.uid} />
                <AcceptButton uid={booking.uid} />
              </div>
            </div>
          ) : canCancel ? (
            <div className="space-y-3 border-b border-border/60 pb-4">
              <h2 className="text-sm font-medium text-foreground">Actions</h2>
              <div className="flex flex-wrap gap-2">
                {rescheduleHref ? (
                  <a
                    href={rescheduleHref}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-[13px] font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    Reschedule
                  </a>
                ) : null}
                <CancelBookingButton uid={booking.uid} />
              </div>
            </div>
          ) : null}

          <h2 className="text-sm font-medium text-foreground">Activity</h2>
          {activity.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ol className="space-y-4">
              {activity.map((entry) => {
                const meta = ACTIVITY_META[entry.type as BookingActivityType] ?? {
                  label: entry.type,
                  icon: Clock,
                  tone: "text-muted-foreground",
                };
                const Icon = meta.icon;
                return (
                  <li key={entry.id} className="flex gap-3">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.tone}`} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground">{meta.label}</p>
                      {entry.message && (
                        <p className="text-xs text-muted-foreground">{entry.message}</p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                        {activityTime.format(new Date(entry.createdAt))}
                        {entry.actor ? ` · ${entry.actor}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
