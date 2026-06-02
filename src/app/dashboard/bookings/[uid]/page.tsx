import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { bookings, attendees } from "@/db/schema";
import { listBookingActivity } from "@/server/activity";
import type { BookingActivityType } from "@/server/activity";
import { formatRange } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  Clock,
  CreditCard,
  Mail,
  MapPin,
  Repeat,
  Star,
  User,
  UserX,
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
  payment_succeeded: { label: "Payment received", icon: CreditCard, tone: "text-emerald-500" },
  reminder_sent: { label: "Reminder sent", icon: Mail, tone: "text-sky-500" },
  review_submitted: { label: "Review submitted", icon: Star, tone: "text-amber-500" },
  no_show: { label: "Marked no-show", icon: UserX, tone: "text-destructive" },
};

export default async function BookingDetailPage({ params }: Props) {
  const user = await requireUser();
  const { uid } = await params;

  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.uid, uid), eq(bookings.userId, user.id)))
    .limit(1);

  if (!booking) notFound();

  const [ats, activity] = await Promise.all([
    db.select().from(attendees).where(eq(attendees.bookingId, booking.id)),
    listBookingActivity(booking.id),
  ]);

  const when = formatRange(booking.startTime, booking.endTime, user.timeZone);

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
          {booking.status === "pending" && <Badge variant="pending">Pending</Badge>}
          {booking.status === "accepted" && <Badge>Confirmed</Badge>}
          {booking.status === "cancelled" && <Badge variant="destructive">Cancelled</Badge>}
          {booking.status === "rejected" && <Badge variant="destructive">Rejected</Badge>}
          {booking.recurringEventId && (
            <Badge variant="outline" className="gap-1">
              <Repeat className="h-3 w-3" />
              Recurring
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="text-sm font-medium text-foreground">Details</h2>
          <dl className="space-y-3 text-[13px]">
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
        </section>

        <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5">
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
