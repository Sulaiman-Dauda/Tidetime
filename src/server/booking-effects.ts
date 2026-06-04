import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attendees,
  bookingReferences,
  bookings,
  eventTypes,
  users,
} from "@/db/schema";
import { generateIcs, bookingIcalUid } from "@/lib/ics";
import { env } from "@/lib/env";
import { sendMail } from "./mailer";
import {
  bookingConfirmedAttendee,
  bookingConfirmedHost,
  bookingPendingAttendee,
  bookingRescheduledAttendee,
  type EmailBookingView,
} from "./emails";
import { dispatchWebhook } from "./webhooks";
import { cancelRemindersForBooking, scheduleRemindersForBooking } from "./reminders";
import { createGoogleCalendarEvent, deleteGoogleCalendarEvent } from "./google-calendar";

interface LoadedBookingContext {
  booking: typeof bookings.$inferSelect;
  eventType: typeof eventTypes.$inferSelect | null;
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

  const [eventType, host, bookingAttendees] = await Promise.all([
    booking.eventTypeId
      ? db.select().from(eventTypes).where(eq(eventTypes.id, booking.eventTypeId)).limit(1).then((rows) => rows[0] ?? null)
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

  return { booking, eventType, host, attendees: bookingAttendees };
}

async function silentlyCancelSupersededBooking(uid: string): Promise<void> {
  const [original] = await db.select().from(bookings).where(eq(bookings.uid, uid)).limit(1);
  if (!original || original.status === "cancelled") return;

  await db
    .update(bookings)
    .set({ status: "cancelled", cancellationReason: "Rescheduled", updatedAt: new Date() })
    .where(eq(bookings.id, original.id));
  await cancelRemindersForBooking(original.id);

  if (!original.userId) return;

  const [ref] = await db
    .select({ uid: bookingReferences.uid, externalCalendarId: bookingReferences.externalCalendarId })
    .from(bookingReferences)
    .where(
      and(
        eq(bookingReferences.bookingId, original.id),
        eq(bookingReferences.type, "google_calendar"),
      ),
    )
    .limit(1);
  if (!ref) return;

  await deleteGoogleCalendarEvent(original.userId, ref.uid, ref.externalCalendarId).catch(
    () => undefined,
  );
  await db.delete(bookingReferences).where(eq(bookingReferences.bookingId, original.id));
}

function buildEmailView(ctx: LoadedBookingContext): EmailBookingView | null {
  const primary = ctx.attendees.find((a) => a.isPrimary) ?? ctx.attendees[0];
  if (!primary) return null;
  const hostName = ctx.host?.name ?? ctx.host?.username ?? "your host";
  const title = ctx.eventType?.title ?? ctx.booking.title;
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
    manageUrl: `${env.appUrl}/booking/${ctx.booking.uid}`,
    hour12: true,
  };
}

function buildHostEmailView(ctx: LoadedBookingContext, attendeeName: string): EmailBookingView {
  const hostName = ctx.host?.name ?? ctx.host?.username ?? "your host";
  const title = ctx.eventType?.title ?? ctx.booking.title;
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
    manageUrl: `${env.appUrl}/booking/${ctx.booking.uid}`,
    hour12: (ctx.host?.timeFormat ?? 12) === 12,
  };
}

/**
 * Side effects for an accepted booking: reminders, attendee/host emails,
 * outgoing webhook, and best-effort Google Calendar event creation.
 * Callers must only invoke this on a real transition to accepted.
 */
export async function runAcceptedBookingEffects(bookingId: number): Promise<void> {
  const ctx = await loadBookingContext(bookingId);
  if (!ctx || ctx.booking.status !== "accepted") return;

  const primary = ctx.attendees.find((a) => a.isPrimary) ?? ctx.attendees[0];
  const attendeeView = buildEmailView(ctx);
  if (!primary || !attendeeView) return;

  if (ctx.booking.rescheduledFromUid) {
    await silentlyCancelSupersededBooking(ctx.booking.rescheduledFromUid);
  }

  const hostName = ctx.host?.name ?? ctx.host?.username ?? "your host";
  const title = ctx.eventType?.title ?? ctx.booking.title;
  const ics = generateIcs({
    uid: bookingIcalUid(ctx.booking.uid),
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
  });

  const tasks: Promise<unknown>[] = [];
  const attendeeMessage = ctx.booking.rescheduledFromUid
    ? bookingRescheduledAttendee(attendeeView)
    : bookingConfirmedAttendee(attendeeView);
  tasks.push(
    sendMail({
      to: primary.email,
      subject: attendeeMessage.subject,
      html: attendeeMessage.html,
      icalEvent: { method: "REQUEST", content: ics },
    }),
  );

  if (ctx.host) {
    const hostMessage = bookingConfirmedHost(buildHostEmailView(ctx, primary.name));
    tasks.push(
      sendMail({
        to: ctx.host.email,
        subject: hostMessage.subject,
        html: hostMessage.html,
        icalEvent: { method: "REQUEST", content: ics },
      }),
    );

    tasks.push(
      scheduleRemindersForBooking(
        ctx.booking.id,
        ctx.host.id,
        ctx.booking.eventTypeId ?? 0,
        ctx.booking.startTime,
      ),
    );

    tasks.push(
      dispatchWebhook(
        ctx.host.id,
        ctx.booking.rescheduledFromUid ? "booking_rescheduled" : "booking_created",
        {
          uid: ctx.booking.uid,
          eventTypeId: ctx.booking.eventTypeId,
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
        const [existingRef] = await db
          .select({ id: bookingReferences.id })
          .from(bookingReferences)
          .where(
            and(
              eq(bookingReferences.bookingId, ctx.booking.id),
              eq(bookingReferences.type, "google_calendar"),
            ),
          )
          .limit(1);
        if (existingRef) return;

        const gEvent = await createGoogleCalendarEvent(ctx.host!.id, {
          summary: title,
          description: ctx.booking.description ?? undefined,
          start: ctx.booking.startTime,
          end: ctx.booking.endTime,
          timeZone: ctx.host!.timeZone,
          location: ctx.booking.meetingUrl ?? ctx.booking.location ?? undefined,
          attendees: ctx.attendees.map((a) => ({ email: a.email, name: a.name })),
        });
        if (!gEvent) return;

        await db.insert(bookingReferences).values({
          bookingId: ctx.booking.id,
          type: "google_calendar",
          uid: gEvent.eventId,
          meetingUrl: gEvent.meetingUrl ?? null,
          externalCalendarId: gEvent.calendarId,
          credentialId: null,
        });

        if (gEvent.meetingUrl && !ctx.booking.meetingUrl) {
          await db
            .update(bookings)
            .set({ meetingUrl: gEvent.meetingUrl })
            .where(eq(bookings.id, ctx.booking.id));
        }
      })(),
    );
  }

  await Promise.allSettled(tasks);
}

/**
 * Side effects for a booking that now needs host approval. Callers should only
 * invoke this after the attendee has finished any required payment.
 */
export async function runPendingApprovalEffects(bookingId: number): Promise<void> {
  const ctx = await loadBookingContext(bookingId);
  if (!ctx || ctx.booking.status !== "pending") return;

  const primary = ctx.attendees.find((a) => a.isPrimary) ?? ctx.attendees[0];
  const attendeeView = buildEmailView(ctx);
  if (!primary || !attendeeView) return;

  const tasks: Promise<unknown>[] = [];
  const attendeeMessage = bookingPendingAttendee(attendeeView);
  tasks.push(
    sendMail({
      to: primary.email,
      subject: attendeeMessage.subject,
      html: attendeeMessage.html,
    }),
  );

  if (ctx.host) {
    const hostMessage = bookingConfirmedHost(buildHostEmailView(ctx, primary.name));
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
        eventTypeId: ctx.booking.eventTypeId,
        title: ctx.eventType?.title ?? ctx.booking.title,
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
