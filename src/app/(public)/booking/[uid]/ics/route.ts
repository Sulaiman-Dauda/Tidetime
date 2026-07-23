import { getBookingByUid } from "@/server/bookings";
import { generateIcs, bookingIcalUid } from "@/lib/ics";
import { rescheduleRootUid } from "@/server/booking-effects";

/**
 * Downloadable .ics for the "Add to calendar" button on the booking page.
 * Uses the same stable chain UID + SEQUENCE as the emailed invite, so
 * importing it updates the existing calendar entry instead of duplicating it.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ uid: string }> },
): Promise<Response> {
  const { uid } = await params;
  const data = await getBookingByUid(uid);
  if (!data || data.booking.status === "cancelled" || data.booking.status === "rejected") {
    return new Response("Not found", { status: 404 });
  }

  const { booking, attendees, host, service } = data;
  const ics = generateIcs({
    uid: bookingIcalUid(await rescheduleRootUid(booking.uid, booking.rescheduledFromUid)),
    start: booking.startTime,
    end: booking.endTime,
    summary: service?.title ?? booking.title,
    description: booking.description ?? undefined,
    location: booking.meetingUrl ?? booking.location ?? undefined,
    organizer: host
      ? { name: host.name ?? host.username, email: `${host.username}@tidetime` }
      : undefined,
    attendees: attendees.map((a) => ({ name: a.name, email: a.email })),
    url: booking.meetingUrl ?? undefined,
    status: "CONFIRMED",
    sequence: booking.sequence,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="booking-${uid}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
