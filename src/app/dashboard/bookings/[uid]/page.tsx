import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/guard";
import { db } from "@/db";
import { bookings, attendees, services } from "@/db/schema";
import { can } from "@/lib/rbac";
import { listBookingActivity } from "@/server/activity";
import type { BookingActivityType } from "@/server/activity";
import { formatRange } from "@/lib/format";
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

function formatResponseValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined) return "—";
  return String(value);
}

export default async function BookingDetailPage({ params }: Props) {
  const { user, role, teamId } = await requireAnyPermission([
    "booking.own.view",
    "booking.all.view",
  ]);
  const { uid } = await params;


  const [row] = await db
    .select({ booking: bookings })
    .from(bookings)
    .leftJoin(services, eq(services.id, bookings.serviceId))
    .where(
      and(
        eq(bookings.uid, uid),
        can(role, "booking.all.view")
          ? eq(services.teamId, teamId)
          : eq(bookings.userId, user.id),
      ),
    )
    .limit(1);

  const booking = row?.booking;
  if (!booking) notFound();

  const [ats, activity, serviceRow] = await Promise.all([
    db.select().from(attendees).where(eq(attendees.bookingId, booking.id)),
    listBookingActivity(booking.id),
    booking.serviceId
      ? db
          .select({ bookingFields: services.bookingFields })
          .from(services)
          .where(eq(services.id, booking.serviceId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  const when = formatRange(booking.startTime, booking.endTime, user.timeZone);
  const fieldLabels = new Map((serviceRow?.bookingFields ?? []).map((field) => [field.name, field.label]));
  const responseEntries = Object.entries(booking.responses ?? {}).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
  const canCancel = booking.status === "accepted" && booking.endTime.getTime() >= Date.now();

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
              {ats.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-foreground">{a.name}</span>
                  <a href={`mailto:${a.email}`} className="hover:underline">
                    {a.email}
                  </a>
                </div>
              ))}
            </dl>
          </div>

          <div className="border-t border-border/60 pt-5">
            <h2 className="text-sm font-medium text-foreground">Booking answers</h2>
            {responseEntries.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">No extra answers were submitted.</p>
            ) : (
              <dl className="mt-4 space-y-3 text-[13px]">
                {responseEntries.map(([key, value]) => (
                  <div key={key} className="grid gap-1 sm:grid-cols-[140px_1fr]">
                    <dt className="text-muted-foreground">{fieldLabels.get(key) ?? key}</dt>
                    <dd className="text-foreground">{formatResponseValue(value)}</dd>
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
              <CancelBookingButton uid={booking.uid} />
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
                        {new Date(entry.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
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
