import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { bookings, attendees } from "@/db/schema";
import { formatRange } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { decideBookingAction, cancelByHostAction } from "./actions";
import { CalendarX2, Check, Clock, MapPin, User, X } from "lucide-react";

type Filter = "upcoming" | "pending" | "past" | "cancelled";

interface BookingRow {
  uid: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location: string | null;
  meetingUrl: string | null;
  status: string;
  attendeeNames: string[];
  attendeeTz: string;
}

async function loadBookings(userId: number, filter: Filter): Promise<BookingRow[]> {
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
    .select()
    .from(bookings)
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
    .where(inArray(attendees.bookingId, rows.map((r) => r.id)));

  const byBooking = new Map<number, typeof ats>();
  for (const a of ats) {
    const list = byBooking.get(a.bookingId) ?? [];
    list.push(a);
    byBooking.set(a.bookingId, list);
  }

  return rows.map((r) => {
    const list = byBooking.get(r.id) ?? [];
    const primary = list.find((a) => a.isPrimary) ?? list[0];
    return {
      uid: r.uid,
      title: r.title,
      startTime: r.startTime,
      endTime: r.endTime,
      location: r.location,
      meetingUrl: r.meetingUrl,
      status: r.status,
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
    <div className="max-w-7xl mx-auto space-y-8">
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
              <a href={`/dashboard/bookings?tab=${f}`}>{FILTER_LABELS[f]}</a>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={active} className="mt-6">
          {rows.length === 0 ? (
            <EmptyState filter={active} />
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
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
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
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

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/dashboard/bookings/${booking.uid}`}
            className="text-[14px] font-medium text-foreground hover:underline"
          >
            {booking.title}
          </a>
          {booking.status === "pending" && (
            <Badge variant="pending">Pending</Badge>
          )}
          {booking.status === "cancelled" && (
            <Badge variant="destructive">Cancelled</Badge>
          )}
          {booking.status === "rejected" && (
            <Badge variant="destructive">Rejected</Badge>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {when}
          </span>
          {booking.attendeeNames.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3 w-3" />
              {booking.attendeeNames.join(", ")}
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

      {filter === "pending" && (
        <div className="flex shrink-0 items-center gap-2">
          <form action={decideBookingAction}>
            <input type="hidden" name="uid" value={booking.uid} />
            <input type="hidden" name="decision" value="rejected" />
            <Button type="submit" variant="outline" size="sm">
              <X className="h-3.5 w-3.5" />
              Decline
            </Button>
          </form>
          <form action={decideBookingAction}>
            <input type="hidden" name="uid" value={booking.uid} />
            <input type="hidden" name="decision" value="accepted" />
            <Button type="submit" size="sm">
              <Check className="h-3.5 w-3.5" />
              Accept
            </Button>
          </form>
        </div>
      )}

      {filter === "upcoming" && (
        <form action={cancelByHostAction} className="shrink-0">
          <input type="hidden" name="uid" value={booking.uid} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
          >
            Cancel
          </Button>
        </form>
      )}
    </div>
  );
}
