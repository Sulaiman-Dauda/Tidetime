import Link from "next/link";
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { bookings, attendees, eventTypes } from "@/db/schema";
import { formatRange } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CancelBookingButton, AcceptButton, DeclineButton } from "./_components/booking-actions";
import { CalendarX2, Clock, CreditCard, MapPin, User, X } from "lucide-react";
import { expireStalePaymentHolds } from "@/server/payment-holds";

type Filter = "upcoming" | "pending" | "past" | "cancelled";

interface BookingRow {
  uid: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location: string | null;
  meetingUrl: string | null;
  status: string;
  paid: boolean;
  requiresPayment: boolean;
  attendeeNames: string[];
  attendeeTz: string;
}

async function loadBookings(userId: number, filter: Filter): Promise<BookingRow[]> {
  await expireStalePaymentHolds();
  const now = new Date();
  const conditions = [eq(bookings.userId, userId)];

  if (filter === "upcoming") {
    conditions.push(eq(bookings.status, "accepted"), gte(bookings.endTime, now));
  } else if (filter === "pending") {
    conditions.push(eq(bookings.status, "pending"));
  } else if (filter === "past") {
    conditions.push(inArray(bookings.status, ["accepted"]), lt(bookings.endTime, now));
  } else {
    conditions.push(inArray(bookings.status, ["cancelled", "rejected"]));
  }

  const rows = await db
    .select({ booking: bookings, requiresPayment: eventTypes.requiresPayment })
    .from(bookings)
    .leftJoin(eventTypes, eq(bookings.eventTypeId, eventTypes.id))
    .where(and(...conditions))
    .orderBy(
      filter === "past" || filter === "cancelled"
        ? desc(bookings.startTime)
        : bookings.startTime,
    )
    .limit(100);

  if (rows.length === 0) return [];

  const ats = await db
    .select()
    .from(attendees)
    .where(inArray(attendees.bookingId, rows.map((r) => r.booking.id)));

  const byBooking = new Map<number, typeof ats>();
  for (const a of ats) {
    const list = byBooking.get(a.bookingId) ?? [];
    list.push(a);
    byBooking.set(a.bookingId, list);
  }

  return rows.map(({ booking, requiresPayment }) => {
    const list = byBooking.get(booking.id) ?? [];
    const primary = list.find((a) => a.isPrimary) ?? list[0];
    return {
      uid: booking.uid,
      title: booking.title,
      startTime: booking.startTime,
      endTime: booking.endTime,
      location: booking.location,
      meetingUrl: booking.meetingUrl,
      status: booking.status,
      paid: booking.paid,
      requiresPayment: requiresPayment ?? false,
      attendeeNames: list.map((a) => a.name),
      attendeeTz: primary?.timeZone ?? "UTC",
    };
  });
}

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

const FILTERS: Filter[] = ["upcoming", "pending", "past", "cancelled"];
const FILTER_LABELS: Record<Filter, string> = {
  upcoming: "Upcoming",
  pending: "Pending",
  past: "Past",
  cancelled: "Cancelled",
};

export default async function BookingsPage({ searchParams }: Props) {
  const user = await requireUser();
  const { tab } = await searchParams;
  const active: Filter = FILTERS.includes(tab as Filter) ? (tab as Filter) : "upcoming";
  const rows = await loadBookings(user.id, active);

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Bookings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Upcoming, pending, and historical meetings.
        </p>
      </div>

      <Tabs value={active}>
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f} value={f} asChild>
              <Link href={`/dashboard/bookings?tab=${f}`}>{FILTER_LABELS[f]}</Link>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={active} className="mt-6">
          {rows.length === 0 ? (
            <EmptyState filter={active} />
          ) : (
            <div className="divide-y divide-border rounded-2xl border border-border/60 bg-card">
              {rows.map((b) => (
                <BookingRow key={b.uid} booking={b} filter={active} userTz={user.timeZone} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
      <CalendarX2 className="h-8 w-8 text-muted-foreground/50" />
      <p className="mt-3 text-sm font-medium text-foreground">No {filter} bookings</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {filter === "upcoming"
          ? "Share your booking link to start receiving meetings."
          : "Nothing to show here."}
      </p>
    </div>
  );
}

function BookingRow({
  booking,
  filter,
  userTz,
}: {
  booking: BookingRow;
  filter: Filter;
  userTz: string;
}) {
  const when = formatRange(booking.startTime, booking.endTime, userTz);
  const attendeeSummary =
    booking.attendeeNames.length <= 1
      ? booking.attendeeNames[0]
      : `${booking.attendeeNames[0]} + ${booking.attendeeNames.length - 1} guest${booking.attendeeNames.length - 1 === 1 ? "" : "s"}`;
  const awaitingPayment = booking.status === "pending" && booking.requiresPayment && !booking.paid;

  return (
    <div className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-secondary/30 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/bookings/${booking.uid}`}
            className="text-[14px] font-medium text-foreground hover:underline"
          >
            {booking.title}
          </Link>
          {booking.status === "pending" && (
            <Badge variant="pending" className="gap-1">
              {awaitingPayment ? <CreditCard className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
              {awaitingPayment ? "Awaiting payment" : "Pending"}
            </Badge>
          )}
          {booking.status === "cancelled" && (
            <Badge variant="destructive" className="gap-1">
              <X className="h-2.5 w-2.5" />
              Cancelled
            </Badge>
          )}
          {booking.status === "rejected" && (
            <Badge variant="destructive" className="gap-1">
              <X className="h-2.5 w-2.5" />
              Rejected
            </Badge>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {when}
          </span>
          {attendeeSummary && (
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3 w-3" />
              {attendeeSummary}
            </span>
          )}
          {booking.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              {booking.meetingUrl ? (
                <a
                  href={booking.meetingUrl}
                  className="hover:text-foreground hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {booking.location}
                </a>
              ) : (
                booking.location
              )}
            </span>
          )}
        </div>
      </div>

      {filter === "pending" && !awaitingPayment && (
        <div className="flex shrink-0 items-center gap-2">
          <DeclineButton uid={booking.uid} />
          <AcceptButton uid={booking.uid} />
        </div>
      )}

      {filter === "upcoming" && (
        <CancelBookingButton uid={booking.uid} />
      )}
    </div>
  );
}
