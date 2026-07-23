import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  attendees,
  bookingReferences,
  bookings,
  services,
  users,
} from "@/db/schema";
import { generateIcs, bookingIcalUid } from "@/lib/ics";
import { getAppUrl } from "@/server/app-url";
import { sendMail } from "./mailer";
import {
  bookingConfirmedAttendee,
  bookingConfirmedHost,
  bookingPendingAttendee,
  bookingRescheduledAttendee,
  type EmailBookingView,
} from "./emails";
import { dispatchWebhook } from "./webhooks";
import { createCalendarEvents, deleteCalendarEvent, updateCalendarEvents } from "./calendar";
import { buildRsvpLinks } from "./rsvp";

interface LoadedBookingContext {
  booking: typeof bookings.$inferSelect;
  service: typeof services.$inferSelect | null;
  host:
    | {
        id: number;
        username: string;
        name: string | null;
        email: string;
        timeZone: string;
        timeFormat: number;
      }
    | null;
  attendees: (typeof attendees.$inferSelect)[];
}

async function loadBookingContext(bookingId: number): Promise<LoadedBookingContext | null> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) return null;

  const [service, host, bookingAttendees] = await Promise.all([
    booking.serviceId
      ? db.select().from(services).where(eq(services.id, booking.serviceId)).limit(1).then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    booking.userId
      ? db
          .select({
            id: users.id,
            username: users.username,
            name: users.name,
            email: users.email,
            timeZone: users.timeZone,
            timeFormat: users.timeFormat,
          })
          .from(users)
          .where(eq(users.id, booking.userId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    db.select().from(attendees).where(eq(attendees.bookingId, bookingId)),
  ]);

  return { booking, service, host, attendees: bookingAttendees };
}

/**
 * Walk the reschedule chain back to the original booking's uid. Every reschedule
 * of the same meeting shares one stable iCalendar UID (derived from this root)
 * so the attendee's calendar UPDATES the event in place — combined with a
 * strictly increasing SEQUENCE — instead of leaving a stale duplicate behind.
 * This is the correctness lesson EasyAppointments encodes with its `sequence`
 * field: without a monotonic SEQUENCE, Outlook/Apple ignore the update entirely.
 */
export async function rescheduleRootUid(
  uid: string,
  rescheduledFromUid: string | null,
): Promise<string> {
  let current = rescheduledFromUid;
  let root = uid;
  for (let i = 0; i < 50 && current; i++) {
    const [prev] = await db
      .select({ uid: bookings.uid, from: bookings.rescheduledFromUid })
      .from(bookings)
      .where(eq(bookings.uid, current))
      .limit(1);
    if (!prev) break;
    root = prev.uid;
    current = prev.from;
  }
  return root;
}

async function silentlyCancelSupersededBooking(uid: string): Promise<void> {
  const [original] = await db.select().from(bookings).where(eq(bookings.uid, uid)).limit(1);
  if (!original || original.status === "cancelled") return;

  await db
    .update(bookings)
    .set({ status: "cancelled", cancellationReason: "Rescheduled", updatedAt: new Date() })
    .where(eq(bookings.id, original.id));
  if (!original.userId) return;

  const refs = await db
    .select({
      eventId: bookingReferences.eventId,
      calendarId: bookingReferences.calendarId,
    })
    .from(bookingReferences)
    .where(eq(bookingReferences.bookingId, original.id));

  for (const ref of refs) {
    await deleteCalendarEvent(
      original.userId,
      ref.eventId,
      ref.calendarId,
    ).catch(() => undefined);
  }
  await db.delete(bookingReferences).where(eq(bookingReferences.bookingId, original.id));
}

async function buildEmailView(ctx: LoadedBookingContext): Promise<EmailBookingView | null> {
  const primary = ctx.attendees.find((a) => a.isPrimary) ?? ctx.attendees[0];
  if (!primary) return null;
  const hostName = ctx.host?.name ?? ctx.host?.username ?? "your host";
  const title = ctx.service?.title ?? ctx.booking.title;
  const appUrl = await getAppUrl();
  return {
    title,
    start: ctx.booking.startTime,
    end: ctx.booking.endTime,
    timeZone: primary.timeZone,
    hostName,
    attendeeName: primary.name,
    location: ctx.booking.location ?? "Online",
    meetingUrl: ctx.booking.meetingUrl,
    description: ctx.booking.description,
    manageUrl: `${appUrl}/booking/${ctx.booking.uid}`,
    hour12: true,
  };
}

async function buildHostEmailView(ctx: LoadedBookingContext, attendeeName: string): Promise<EmailBookingView> {
  const hostName = ctx.host?.name ?? ctx.host?.username ?? "your host";
  const title = ctx.service?.title ?? ctx.booking.title;
  const appUrl = await getAppUrl();
  return {
    title,
    start: ctx.booking.startTime,
    end: ctx.booking.endTime,
    timeZone: ctx.host?.timeZone ?? "UTC",
    hostName,
    attendeeName,
    location: ctx.booking.location ?? "Online",
    meetingUrl: ctx.booking.meetingUrl,
    description: ctx.booking.description,
    manageUrl: `${appUrl}/booking/${ctx.booking.uid}`,
    hour12: (ctx.host?.timeFormat ?? 12) === 12,
  };
}

/**
 * Side effects for an accepted booking: attendee/host emails,
 * outgoing webhook, and best-effort Google Calendar event creation.
 * Callers must only invoke this on a real transition to accepted.
 */
export async function runAcceptedBookingEffects(bookingId: number): Promise<void> {
  const ctx = await loadBookingContext(bookingId);
  if (!ctx || ctx.booking.status !== "accepted") return;

  const primary = ctx.attendees.find((a) => a.isPrimary) ?? ctx.attendees[0];
  if (!primary) return;

  if (ctx.booking.rescheduledFromUid) {
    await silentlyCancelSupersededBooking(ctx.booking.rescheduledFromUid);
  }

  // Build email views AFTER conferencing so the link is included.
  const attendeeView = await buildEmailView(ctx);
  if (!attendeeView) return;
  // Signed RSVP links let the attendee answer Accept / Decline / Tentative right
  // from the confirmation email; the reply lands on their attendee record.
  attendeeView.rsvp = await buildRsvpLinks(ctx.booking.uid, primary.email);

  const hostName = ctx.host?.name ?? ctx.host?.username ?? "your host";
  const title = ctx.service?.title ?? ctx.booking.title;
  // Stable UID across the whole reschedule chain + the booking's SEQUENCE so the
  // attendee's calendar treats a reschedule as an in-place update, not a dupe.
  const icalUid = bookingIcalUid(
    await rescheduleRootUid(ctx.booking.uid, ctx.booking.rescheduledFromUid),
  );
  const ics = generateIcs({
    uid: icalUid,
    start: ctx.booking.startTime,
    end: ctx.booking.endTime,
    summary: title,
    description: ctx.booking.description ?? undefined,
    location: ctx.booking.meetingUrl ?? ctx.booking.location ?? undefined,
    organizer: ctx.host
      ? { name: hostName, email: `${ctx.host.username}@tidetime` }
      : undefined,
    attendees: [{ name: primary.name, email: primary.email }],
    url: ctx.booking.meetingUrl ?? undefined,
    status: "CONFIRMED",
    sequence: ctx.booking.sequence,
  });

  const tasks: Promise<unknown>[] = [];
  const attendeeMessage = ctx.booking.rescheduledFromUid
    ? await bookingRescheduledAttendee(attendeeView)
    : await bookingConfirmedAttendee(attendeeView);
  tasks.push(
    sendMail({
      to: primary.email,
      subject: attendeeMessage.subject,
      html: attendeeMessage.html,
      icalEvent: { method: "REQUEST", content: ics },
    }),
  );

  if (ctx.host) {
    const hostMessage = await bookingConfirmedHost(await buildHostEmailView(ctx, primary.name));
    tasks.push(
      sendMail({
        to: ctx.host.email,
        subject: hostMessage.subject,
        html: hostMessage.html,
        icalEvent: { method: "REQUEST", content: ics },
      }),
    );

    tasks.push(
      dispatchWebhook(
        ctx.host.id,
        ctx.booking.rescheduledFromUid ? "booking_rescheduled" : "booking_created",
        {
          uid: ctx.booking.uid,
          serviceId: ctx.booking.serviceId,
          title,
          startTime: ctx.booking.startTime.toISOString(),
          endTime: ctx.booking.endTime.toISOString(),
          attendee: {
            name: primary.name,
            email: primary.email,
            timeZone: primary.timeZone,
          },
          status: ctx.booking.status,
        },
      ),
    );

    tasks.push(
      (async () => {
        const existing = await db
          .select({ id: bookingReferences.id })
          .from(bookingReferences)
          .where(eq(bookingReferences.bookingId, ctx.booking.id));
        if (existing.length > 0) return;

        const refs = await createCalendarEvents(ctx.host!.id, {
          summary: title,
          description: ctx.booking.description ?? undefined,
          start: ctx.booking.startTime,
          end: ctx.booking.endTime,
          timeZone: ctx.host!.timeZone,
          location: ctx.booking.meetingUrl ?? ctx.booking.location ?? undefined,
          attendees: ctx.attendees.map((a) => ({ email: a.email, name: a.name })),
          conferenceProvider: ctx.service?.locations.some((location) => location.type === "google_meet")
            ? "google_meet"
            : undefined,
          icalUid,
          sequence: ctx.booking.sequence,
        });
        if (refs.length === 0) return;

        await db.insert(bookingReferences).values(
          refs.map((r) => ({
            bookingId: ctx.booking.id,
            eventId: r.eventId,
            calendarId: r.calendarId,
          })),
        );

        const meetingUrl = refs.find((r) => r.meetingUrl)?.meetingUrl;
        if (meetingUrl && !ctx.booking.meetingUrl) {
          await db
            .update(bookings)
            .set({ meetingUrl })
            .where(eq(bookings.id, ctx.booking.id));
        }
      })(),
    );
  }

  await Promise.allSettled(tasks);
}

/**
 * Side effects when a host moves an accepted booking to a new time (e.g. by
 * dragging it on the dashboard calendar). Refreshes external calendar events,
 * emails the attendee an updated invite (stable UID + bumped SEQUENCE so their
 * calendar updates in place), and fires the
 * booking_rescheduled webhook. The caller must have already persisted the new
 * times + incremented sequence.
 */
export async function runBookingMovedEffects(bookingId: number): Promise<void> {
  const ctx = await loadBookingContext(bookingId);
  if (!ctx || ctx.booking.status !== "accepted") return;
  const primary = ctx.attendees.find((a) => a.isPrimary) ?? ctx.attendees[0];
  if (!primary) return;

  const title = ctx.service?.title ?? ctx.booking.title;
  const hostName = ctx.host?.name ?? ctx.host?.username ?? "your host";
  const icalUid = bookingIcalUid(
    await rescheduleRootUid(ctx.booking.uid, ctx.booking.rescheduledFromUid),
  );
  const ics = generateIcs({
    uid: icalUid,
    start: ctx.booking.startTime,
    end: ctx.booking.endTime,
    summary: title,
    description: ctx.booking.description ?? undefined,
    location: ctx.booking.meetingUrl ?? ctx.booking.location ?? undefined,
    organizer: ctx.host ? { name: hostName, email: `${ctx.host.username}@tidetime` } : undefined,
    attendees: [{ name: primary.name, email: primary.email }],
    url: ctx.booking.meetingUrl ?? undefined,
    status: "CONFIRMED",
    sequence: ctx.booking.sequence,
  });

  const tasks: Promise<unknown>[] = [];

  const view = await buildEmailView(ctx);
  if (view) {
    const msg = await bookingRescheduledAttendee(view);
    tasks.push(
      sendMail({
        to: primary.email,
        subject: msg.subject,
        html: msg.html,
        icalEvent: { method: "REQUEST", content: ics },
      }),
    );
  }

  if (ctx.host) {
    // Refresh external calendar events. Preferred path is a true in-place UPDATE
    // (preserves the event id + any Meet/Teams link); only if a provider can't
    // update do we fall back to dropping + recreating its event.
    tasks.push(
      (async () => {
        const refs = await db
          .select()
          .from(bookingReferences)
          .where(eq(bookingReferences.bookingId, ctx.booking.id));
        const calendarRefs = refs;

        const eventInput = {
          summary: title,
          description: ctx.booking.description ?? undefined,
          start: ctx.booking.startTime,
          end: ctx.booking.endTime,
          timeZone: ctx.host!.timeZone,
          location: ctx.booking.meetingUrl ?? ctx.booking.location ?? undefined,
          attendees: ctx.attendees.map((a) => ({ email: a.email, name: a.name })),
          icalUid,
          sequence: ctx.booking.sequence,
        };

        if (calendarRefs.length > 0) {
          const updated = await updateCalendarEvents(
            ctx.host!.id,
            calendarRefs.map((r) => ({
              eventId: r.eventId,
              calendarId: r.calendarId,
            })),
            eventInput,
          );
          // Every provider updated in place — nothing more to do.
          if (updated.length > 0 && updated.every(Boolean)) return;
          // Partial failure: tear every calendar event down so the recreate below
          // can't leave a duplicate next to an already-updated one.
          for (const ref of calendarRefs) {
            await deleteCalendarEvent(
              ctx.host!.id,
              ref.eventId,
              ref.calendarId,
            ).catch(() => undefined);
          }
          await db
            .delete(bookingReferences)
            .where(inArray(bookingReferences.id, calendarRefs.map((r) => r.id)));
        }

        const created = await createCalendarEvents(ctx.host!.id, {
          ...eventInput,
          conferenceProvider: ctx.service?.locations.some((location) => location.type === "google_meet")
            ? "google_meet"
            : undefined,
        });
        if (created.length > 0) {
          await db.insert(bookingReferences).values(
            created.map((r) => ({
              bookingId: ctx.booking.id,
              eventId: r.eventId,
              calendarId: r.calendarId,
            })),
          );
        }
      })(),
    );

    tasks.push(
      dispatchWebhook(ctx.host.id, "booking_rescheduled", {
        uid: ctx.booking.uid,
        serviceId: ctx.booking.serviceId,
        title,
        startTime: ctx.booking.startTime.toISOString(),
        endTime: ctx.booking.endTime.toISOString(),
        attendee: { name: primary.name, email: primary.email, timeZone: primary.timeZone },
        status: ctx.booking.status,
      }),
    );
  }

  await Promise.allSettled(tasks);
}

/**
 * Notify both parties when a booking is waiting for provider approval.
 */
export async function runPendingApprovalEffects(bookingId: number): Promise<void> {
  const ctx = await loadBookingContext(bookingId);
  if (!ctx || ctx.booking.status !== "pending") return;

  const primary = ctx.attendees.find((a) => a.isPrimary) ?? ctx.attendees[0];
  const attendeeView = await buildEmailView(ctx);
  if (!primary || !attendeeView) return;

  const tasks: Promise<unknown>[] = [];
  const attendeeMessage = await bookingPendingAttendee(attendeeView);
  tasks.push(
    sendMail({
      to: primary.email,
      subject: attendeeMessage.subject,
      html: attendeeMessage.html,
    }),
  );

  if (ctx.host) {
    const hostMessage = await bookingConfirmedHost(await buildHostEmailView(ctx, primary.name));
    tasks.push(
      sendMail({
        to: ctx.host.email,
        subject: `Approval needed: ${hostMessage.subject}`,
        html: hostMessage.html,
      }),
    );

    tasks.push(
      dispatchWebhook(ctx.host.id, "booking_requested", {
        uid: ctx.booking.uid,
        serviceId: ctx.booking.serviceId,
        title: ctx.service?.title ?? ctx.booking.title,
        startTime: ctx.booking.startTime.toISOString(),
        endTime: ctx.booking.endTime.toISOString(),
        attendee: {
          name: primary.name,
          email: primary.email,
          timeZone: primary.timeZone,
        },
        status: ctx.booking.status,
      }),
    );
  }

  await Promise.allSettled(tasks);
}
