import "server-only";
import { and, eq, gte, lt, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bookings, attendees, eventTypes, eventTypeHosts, users, type BookingField } from "@/db/schema";
import { checkTeamCapacity, CAPACITY_MESSAGES, type CapacityRule } from "@/lib/team-availability";
import { shortId } from "@/lib/crypto";
import { getPublicEventType, isSlotBookable, type ResolvedEventType } from "./availability";
import { resolveLocation } from "@/lib/locations";
import { generateIcs, bookingIcalUid } from "@/lib/ics";
import { sendMail } from "./mailer";
import {
  bookingConfirmedAttendee,
  bookingConfirmedHost,
  bookingPendingAttendee,
  bookingCancelledAttendee,
  bookingRescheduledAttendee,
  bookingSeriesConfirmedAttendee,
  type EmailBookingView,
} from "./emails";
import { dispatchWebhook } from "./webhooks";
import { assignTeamHosts } from "./round-robin";
import { scheduleRemindersForBooking, cancelRemindersForBooking } from "./reminders";
import { createBookingPayment, refundBookingPayment } from "./stripe";
import { resolveBookingLink, consumeBookingLink } from "./booking-links";
import { reserveResourcesForBooking } from "./resources";
import { getTeamEventType } from "./teams-public";
import { validateResponses as validateFieldResponses, type FieldValues } from "@/lib/booking-fields";
import { normalizeRecurringRule, expandRecurrence } from "@/lib/recurrence";
import { logBookingActivity } from "./activity";
import { env } from "@/lib/env";
import { isValidTimeZone } from "@/lib/time";

export interface CreateBookingInput {
  username: string;
  slug: string;
  /** when set, resolves a team event type by team slug instead of a user handle */
  teamSlug?: string;
  /** UTC ISO start */
  start: string;
  duration?: number;
  timeZone: string;
  name: string;
  email: string;
  /** answers keyed by field name */
  responses: Record<string, unknown>;
  guests?: string[];
  /** dedupe double submits */
  idempotencyKey?: string;
  rescheduleUid?: string;
  /** temporary booking-link token, validated and consumed on success */
  bookingLinkToken?: string;
}

export interface BookingResult {
  ok: boolean;
  uid?: string;
  error?: string;
  /** present when the booking requires up-front payment */
  paymentClientSecret?: string;
  requiresPayment?: boolean;
}

function validateResponses(fields: BookingField[], responses: Record<string, unknown>): string | null {
  const errors = validateFieldResponses(fields, responses as FieldValues);
  const first = Object.values(errors)[0];
  return first ?? null;
}

function buildEmailView(args: {
  eventType: ResolvedEventType;
  hostName: string;
  attendeeName: string;
  start: Date;
  end: Date;
  timeZone: string;
  location: string;
  meetingUrl: string | null;
  notes?: string | null;
  uid: string;
  hour12: boolean;
}): EmailBookingView {
  return {
    title: args.eventType.title,
    start: args.start,
    end: args.end,
    timeZone: args.timeZone,
    hostName: args.hostName,
    attendeeName: args.attendeeName,
    location: args.location,
    meetingUrl: args.meetingUrl,
    description: args.notes,
    manageUrl: `${env.appUrl}/booking/${args.uid}`,
    hour12: args.hour12,
  };
}

/** Load the first host attached to a team event type (placeholder before assignment). */
async function firstTeamHost(
  eventTypeId: number,
): Promise<{ id: number; name: string | null; username: string } | null> {
  const [row] = await db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(eventTypeHosts)
    .innerJoin(users, eq(eventTypeHosts.userId, users.id))
    .where(eq(eventTypeHosts.eventTypeId, eventTypeId))
    .limit(1);
  return row ?? null;
}

/** Count team bookings on the target day and overlapping the requested interval. */
async function teamCapacityUsage(
  teamId: number,
  start: Date,
  end: Date,
): Promise<{ bookingsOnDay: number; concurrentBookings: number }> {
  const dayStart = new Date(start);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60000);

  // All active bookings for this team on the target day.
  const rows = await db
    .select({ startTime: bookings.startTime, endTime: bookings.endTime })
    .from(bookings)
    .innerJoin(eventTypes, eq(bookings.eventTypeId, eventTypes.id))
    .where(
      and(
        eq(eventTypes.teamId, teamId),
        inArray(bookings.status, ["accepted", "pending"]),
        gte(bookings.startTime, dayStart),
        lt(bookings.startTime, dayEnd),
      ),
    );

  const concurrentBookings = rows.filter(
    (r) => r.startTime < end && r.endTime > start,
  ).length;
  return { bookingsOnDay: rows.length, concurrentBookings };
}

/** Create a new booking with full validation, persistence, notifications. */
export async function createBooking(input: CreateBookingInput): Promise<BookingResult> {
  let eventType: ResolvedEventType;
  let host: { id: number; name: string | null; username: string };
  let teamCapacity: { teamId: number; rule: CapacityRule } | null = null;

  if (input.teamSlug) {
    const teamResolved = await getTeamEventType(input.teamSlug, input.slug);
    if (!teamResolved) return { ok: false, error: "Event type not found" };
    eventType = teamResolved.eventType;
    teamCapacity = {
      teamId: teamResolved.team.id,
      rule: {
        maxBookingsPerDay: teamResolved.team.maxBookingsPerDay,
        maxConcurrentBookings: teamResolved.team.maxConcurrentBookings,
      },
    };
    // Team events assign their host below; seed a placeholder from the first host.
    const placeholder = await firstTeamHost(eventType.id);
    if (!placeholder) return { ok: false, error: "This team event has no hosts" };
    host = placeholder;
    eventType = { ...eventType, userId: placeholder.id };
  } else {
    const resolved = await getPublicEventType(input.username, input.slug);
    if (!resolved) return { ok: false, error: "Event type not found" };
    eventType = resolved.eventType;
    host = resolved.host;
  }

  // Validate a temporary booking link, if one was used.
  if (input.bookingLinkToken) {
    const link = await resolveBookingLink(input.bookingLinkToken, input.email);
    if (!link.ok) return { ok: false, error: link.error };
    if (link.link && link.link.eventTypeId !== eventType.id) {
      return { ok: false, error: "This link is for a different event" };
    }
  }

  // Idempotency: return the existing booking if this key was already used.
  if (input.idempotencyKey) {
    const [dupe] = await db
      .select({ uid: bookings.uid })
      .from(bookings)
      .where(eq(bookings.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (dupe) return { ok: true, uid: dupe.uid };
  }

  const duration = input.duration ?? eventType.length;
  if (eventType.durations.length > 0 && input.duration && !eventType.durations.includes(input.duration) && input.duration !== eventType.length) {
    return { ok: false, error: "Invalid duration" };
  }

  if (!isValidTimeZone(input.timeZone)) {
    return { ok: false, error: "Invalid timezone" };
  }

  const validationError = validateResponses(eventType.bookingFields, input.responses);
  if (validationError) return { ok: false, error: validationError };

  // Race-safe availability check. Team events validate per-host during assignment.
  const isTeamEvent =
    eventType.schedulingType === "round_robin" || eventType.schedulingType === "collective";
  if (!isTeamEvent) {
    const bookable = await isSlotBookable(eventType, input.start, duration);
    if (!bookable) return { ok: false, error: "That time is no longer available" };
  }

  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "Invalid start time" };
  }
  const end = new Date(start.getTime() + duration * 60000);

  // Enforce team capacity limits (max bookings per day / max concurrent).
  if (teamCapacity) {
    const usage = await teamCapacityUsage(teamCapacity.teamId, start, end);
    const capacity = checkTeamCapacity(teamCapacity.rule, usage);
    if (!capacity.ok) return { ok: false, error: CAPACITY_MESSAGES[capacity.reason] };
  }

  // Team scheduling: pick the host(s) for this slot via round-robin/collective.
  let assignedUserId = eventType.userId;
  let assignedHost = { id: host.id, name: host.name, username: host.username };
  let coHostUserIds: number[] = [];
  if (eventType.schedulingType === "round_robin" || eventType.schedulingType === "collective") {
    const assignment = await assignTeamHosts(
      eventType.id,
      eventType.schedulingType,
      eventType.roundRobinMode,
      start,
      end,
      eventType.scheduleTimeZone,
    );
    if (!assignment) return { ok: false, error: "No host is available for that time" };
    assignedUserId = assignment.hostUserId;
    coHostUserIds = assignment.coHostUserIds;
    const [u] = await db
      .select({ id: users.id, name: users.name, username: users.username })
      .from(users)
      .where(eq(users.id, assignment.hostUserId))
      .limit(1);
    if (u) assignedHost = u;
  }

  const attendeePhone = typeof input.responses.phone === "string" ? input.responses.phone : undefined;
  const { location, meetingUrl } = resolveLocation(eventType.locations[0], attendeePhone);

  // Paid events stay unconfirmed until Stripe confirms the payment.
  const needsPayment = eventType.requiresPayment && eventType.price > 0;
  const status = needsPayment || eventType.requiresConfirmation ? "pending" : "accepted";
  const uid = shortId(12);
  const notes = typeof input.responses.notes === "string" ? (input.responses.notes as string) : null;

  // Recurring events fan out into a series of bookings sharing a recurringEventId.
  // We keep this lean: weekly/monthly only, no payments, no reschedules, personal
  // events only (team host assignment per-occurrence is intentionally out of scope).
  const recurringRule = normalizeRecurringRule(eventType.recurringEvent);
  if (
    recurringRule &&
    recurringRule.count > 1 &&
    !needsPayment &&
    !input.rescheduleUid &&
    !isTeamEvent
  ) {
    return createRecurringSeries({
      eventType,
      host: { id: assignedHost.id, name: assignedHost.name, username: assignedHost.username },
      assignedUserId,
      input,
      duration,
      occurrences: expandRecurrence(start, recurringRule),
      location,
      meetingUrl,
      notes,
      status,
      attendeePhone,
    });
  }

  // Persist booking + attendees in a transaction.
  const bookingId = await db.transaction(async (tx) => {
    const [b] = await tx
      .insert(bookings)
      .values({
        uid,
        eventTypeId: eventType.id,
        userId: assignedUserId,
        title: `${eventType.title} between ${assignedHost.name ?? assignedHost.username} and ${input.name}`,
        description: notes,
        startTime: start,
        endTime: end,
        location,
        meetingUrl,
        status,
        responses: input.responses,
        idempotencyKey: input.idempotencyKey ?? null,
        rescheduledFromUid: input.rescheduleUid ?? null,
      })
      .returning({ id: bookings.id });

    const attendeeRows: (typeof attendees.$inferInsert)[] = [
      { bookingId: b.id, email: input.email, name: input.name, timeZone: input.timeZone, phoneNumber: attendeePhone ?? null, isPrimary: true },
    ];
    if (!eventType.disableGuests) {
      for (const g of input.guests ?? []) {
        if (g.trim()) attendeeRows.push({ bookingId: b.id, email: g.trim(), name: g.trim(), timeZone: input.timeZone, isPrimary: false });
      }
    }
    await tx.insert(attendees).values(attendeeRows);
    return b.id;
  });

  // Reserve any required resources (rooms/equipment/…). The slot engine already
  // excluded at-capacity windows; this is the race-safe final check.
  const reserved = await reserveResourcesForBooking(bookingId, eventType.id, start, end);
  if (!reserved) {
    await db
      .update(bookings)
      .set({ status: "cancelled", cancellationReason: "Resource no longer available" })
      .where(eq(bookings.id, bookingId));
    return { ok: false, error: "A required resource is no longer available for that time" };
  }

  // If this is a reschedule, cancel the original booking.
  if (input.rescheduleUid) {
    await db
      .update(bookings)
      .set({ status: "cancelled", cancellationReason: "Rescheduled", updatedAt: new Date() })
      .where(eq(bookings.uid, input.rescheduleUid));
  }

  // Mark a temporary booking link as used (the slot is now reserved).
  if (input.bookingLinkToken) {
    await consumeBookingLink(input.bookingLinkToken);
  }

  // Paid events: create a Stripe PaymentIntent. The booking is confirmed by the
  // Stripe webhook once payment succeeds — we return the client secret so the
  // front-end can complete the charge.
  if (needsPayment) {
    const pay = await createBookingPayment({
      bookingId,
      bookingUid: uid,
      price: eventType.price,
      depositAmount: eventType.depositAmount,
      currency: eventType.currency,
      description: `${eventType.title} — ${assignedHost.name ?? assignedHost.username}`,
    });
    if (!pay.ok) {
      // Roll back the unpaid booking so the slot is freed.
      await db.update(bookings).set({ status: "cancelled", cancellationReason: "Payment setup failed" }).where(eq(bookings.id, bookingId));
      return { ok: false, error: pay.error ?? "Could not start payment" };
    }
    return { ok: true, uid, requiresPayment: true, paymentClientSecret: pay.clientSecret };
  }

  // Schedule reminder jobs for this booking (best-effort).
  if (assignedUserId && status === "accepted") {
    await scheduleRemindersForBooking(bookingId, assignedUserId, eventType.id, start);
  }

  // Notifications (best-effort, non-blocking for the booker).
  const hostName = assignedHost.name ?? assignedHost.username;
  const ics = generateIcs({
    uid: bookingIcalUid(uid),
    start,
    end,
    summary: eventType.title,
    description: notes ?? undefined,
    location: meetingUrl ?? location,
    organizer: { name: hostName, email: `${assignedHost.username}@tidetime` },
    attendees: [{ name: input.name, email: input.email }],
    url: meetingUrl ?? undefined,
    status: "CONFIRMED",
  });

  const [hostUser] = await db.select({ email: users.email, timeFormat: users.timeFormat }).from(users).where(eq(users.id, assignedHost.id)).limit(1);
  const hour12 = (hostUser?.timeFormat ?? 12) === 12;

  const attendeeView = buildEmailView({ eventType, hostName, attendeeName: input.name, start, end, timeZone: input.timeZone, location, meetingUrl, notes, uid, hour12: true });
  const hostView = buildEmailView({ eventType, hostName, attendeeName: input.name, start, end, timeZone: eventType.hostTimeZone, location, meetingUrl, notes, uid, hour12 });

  const tasks: Promise<unknown>[] = [];
  if (status === "accepted") {
    const a = input.rescheduleUid ? bookingRescheduledAttendee(attendeeView) : bookingConfirmedAttendee(attendeeView);
    tasks.push(sendMail({ to: input.email, subject: a.subject, html: a.html, icalEvent: { method: "REQUEST", content: ics } }));
    if (hostUser) {
      const h = bookingConfirmedHost(hostView);
      tasks.push(sendMail({ to: hostUser.email, subject: h.subject, html: h.html, icalEvent: { method: "REQUEST", content: ics } }));
    }
  } else {
    const a = bookingPendingAttendee(attendeeView);
    tasks.push(sendMail({ to: input.email, subject: a.subject, html: a.html }));
    if (hostUser) {
      const h = bookingConfirmedHost(hostView);
      tasks.push(sendMail({ to: hostUser.email, subject: `Approval needed: ${h.subject}`, html: h.html }));
    }
  }

  if (assignedUserId) {
    tasks.push(
      dispatchWebhook(assignedUserId, input.rescheduleUid ? "booking_rescheduled" : status === "pending" ? "booking_requested" : "booking_created", {
        uid,
        eventTypeId: eventType.id,
        title: eventType.title,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        attendee: { name: input.name, email: input.email, timeZone: input.timeZone },
        coHosts: coHostUserIds,
        status,
      }),
    );
  }

  tasks.push(
    logBookingActivity(bookingId, input.rescheduleUid ? "rescheduled" : "created", {
      actor: input.name,
      message: input.rescheduleUid ? "Rescheduled to a new time" : `Booked by ${input.name}`,
    }),
  );

  await Promise.allSettled(tasks);
  return { ok: true, uid };
}

/**
 * Create a recurring series of bookings sharing one recurringEventId. Each
 * available occurrence becomes its own booking row; unavailable occurrences are
 * skipped. One confirmation email summarising the whole series is sent.
 */
async function createRecurringSeries(args: {
  eventType: ResolvedEventType;
  host: { id: number; name: string | null; username: string };
  assignedUserId: number | null;
  input: CreateBookingInput;
  duration: number;
  occurrences: Date[];
  location: string;
  meetingUrl: string | null;
  notes: string | null;
  status: "accepted" | "pending";
  attendeePhone?: string;
}): Promise<BookingResult> {
  const { eventType, host, assignedUserId, input, duration, location, meetingUrl, notes, status } = args;

  // Keep only occurrences whose slot is still bookable.
  const bookable: { start: Date; end: Date }[] = [];
  for (const occ of args.occurrences) {
    const end = new Date(occ.getTime() + duration * 60000);
    if (await isSlotBookable(eventType, occ.toISOString(), duration)) {
      bookable.push({ start: occ, end });
    }
  }
  if (bookable.length === 0) return { ok: false, error: "That time is no longer available" };

  const recurringEventId = shortId(12);
  const hostName = host.name ?? host.username;

  // Persist all occurrences in a single transaction.
  const created = await db.transaction(async (tx) => {
    const rows: { id: number; uid: string; start: Date; end: Date }[] = [];
    for (const occ of bookable) {
      const uid = shortId(12);
      const [b] = await tx
        .insert(bookings)
        .values({
          uid,
          eventTypeId: eventType.id,
          userId: assignedUserId,
          title: `${eventType.title} between ${hostName} and ${input.name}`,
          description: notes,
          startTime: occ.start,
          endTime: occ.end,
          location,
          meetingUrl,
          status,
          responses: input.responses,
          recurringEventId,
        })
        .returning({ id: bookings.id });

      const attendeeRows: (typeof attendees.$inferInsert)[] = [
        { bookingId: b.id, email: input.email, name: input.name, timeZone: input.timeZone, phoneNumber: args.attendeePhone ?? null, isPrimary: true },
      ];
      if (!eventType.disableGuests) {
        for (const g of input.guests ?? []) {
          if (g.trim()) attendeeRows.push({ bookingId: b.id, email: g.trim(), name: g.trim(), timeZone: input.timeZone, isPrimary: false });
        }
      }
      await tx.insert(attendees).values(attendeeRows);
      rows.push({ id: b.id, uid, start: occ.start, end: occ.end });
    }
    return rows;
  });

  // Per-occurrence side effects: resource reservation + reminders.
  for (const row of created) {
    const reserved = await reserveResourcesForBooking(row.id, eventType.id, row.start, row.end);
    if (!reserved) {
      await db
        .update(bookings)
        .set({ status: "cancelled", cancellationReason: "Resource no longer available" })
        .where(eq(bookings.id, row.id));
      continue;
    }
    if (assignedUserId && status === "accepted") {
      await scheduleRemindersForBooking(row.id, assignedUserId, eventType.id, row.start);
    }
    await logBookingActivity(row.id, "created", {
      actor: input.name,
      message: `Booked by ${input.name} (recurring series)`,
    });
  }

  const first = created[0];

  // One summary email to the attendee + host listing every occurrence.
  const [hostUser] = await db
    .select({ email: users.email, timeFormat: users.timeFormat })
    .from(users)
    .where(eq(users.id, host.id))
    .limit(1);
  const hour12 = (hostUser?.timeFormat ?? 12) === 12;
  const seriesDates = created.map((r) => r.start);
  const baseView = buildEmailView({
    eventType,
    hostName,
    attendeeName: input.name,
    start: first.start,
    end: first.end,
    timeZone: input.timeZone,
    location,
    meetingUrl,
    notes,
    uid: first.uid,
    hour12: true,
  });

  const tasks: Promise<unknown>[] = [];
  const a = bookingSeriesConfirmedAttendee(baseView, seriesDates, input.timeZone, true, status);
  tasks.push(sendMail({ to: input.email, subject: a.subject, html: a.html }));
  if (hostUser) {
    const hostView = buildEmailView({
      eventType,
      hostName,
      attendeeName: input.name,
      start: first.start,
      end: first.end,
      timeZone: eventType.hostTimeZone,
      location,
      meetingUrl,
      notes,
      uid: first.uid,
      hour12,
    });
    const h = bookingSeriesConfirmedAttendee(hostView, seriesDates, eventType.hostTimeZone, hour12, status);
    tasks.push(sendMail({ to: hostUser.email, subject: `New recurring booking: ${h.subject}`, html: h.html }));
  }
  if (assignedUserId) {
    tasks.push(
      dispatchWebhook(assignedUserId, status === "pending" ? "booking_requested" : "booking_created", {
        uid: first.uid,
        recurringEventId,
        occurrences: created.length,
        eventTypeId: eventType.id,
        title: eventType.title,
        startTime: first.start.toISOString(),
        endTime: first.end.toISOString(),
        attendee: { name: input.name, email: input.email, timeZone: input.timeZone },
        status,
      }),
    );
  }
  await Promise.allSettled(tasks);

  return { ok: true, uid: first.uid };
}

/** Cancel a booking by its public UID. Optionally cancels the whole recurring series. */
export async function cancelBooking(
  uid: string,
  reason?: string,
  cancelledByEmail?: string,
  cancelSeries = false,
): Promise<BookingResult> {
  const [b] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.uid, uid))
    .limit(1);
  if (!b) return { ok: false, error: "Booking not found" };
  if (b.status === "cancelled") return { ok: true, uid };

  // Cancel every future booking in the same series when requested.
  if (cancelSeries && b.recurringEventId) {
    const series = await db
      .select({ uid: bookings.uid })
      .from(bookings)
      .where(
        and(
          eq(bookings.recurringEventId, b.recurringEventId),
          inArray(bookings.status, ["accepted", "pending"]),
        ),
      );
    for (const row of series) {
      if (row.uid !== uid) await cancelBooking(row.uid, reason, cancelledByEmail, false);
    }
  }

  await db
    .update(bookings)
    .set({ status: "cancelled", cancellationReason: reason ?? null, cancelledByEmail: cancelledByEmail ?? null, updatedAt: new Date() })
    .where(eq(bookings.id, b.id));

  await cancelRemindersForBooking(b.id);
  await logBookingActivity(b.id, "cancelled", {
    actor: cancelledByEmail ?? "attendee",
    message: reason ? `Cancelled: ${reason}` : "Booking cancelled",
  });

  // Refund any captured payment for this booking (best-effort).
  if (b.paid) {
    await refundBookingPayment(b.id).catch(() => undefined);
  }

  const ats = await db.select().from(attendees).where(eq(attendees.bookingId, b.id));
  const [et] = b.eventTypeId
    ? await db.select({ title: eventTypes.title }).from(eventTypes).where(eq(eventTypes.id, b.eventTypeId)).limit(1)
    : [{ title: b.title }];

  const primary = ats.find((a) => a.isPrimary) ?? ats[0];
  if (primary) {
    const view: EmailBookingView = {
      title: et?.title ?? b.title,
      start: b.startTime,
      end: b.endTime,
      timeZone: primary.timeZone,
      hostName: "your host",
      attendeeName: primary.name,
      location: b.location ?? "Online",
      meetingUrl: b.meetingUrl,
      manageUrl: `${env.appUrl}/booking/${uid}`,
    };
    const m = bookingCancelledAttendee(view, reason);
    await sendMail({ to: primary.email, subject: m.subject, html: m.html });
  }

  if (b.userId) {
    await dispatchWebhook(b.userId, "booking_cancelled", { uid, reason: reason ?? null });
  }

  return { ok: true, uid };
}

/** Approve or reject a pending booking (host action). */
export async function decideBooking(uid: string, decision: "accepted" | "rejected", hostUserId: number): Promise<BookingResult> {
  const [b] = await db.select().from(bookings).where(eq(bookings.uid, uid)).limit(1);
  if (!b || b.userId !== hostUserId) return { ok: false, error: "Not found" };
  if (b.status !== "pending") return { ok: false, error: "Booking is not pending" };

  await db.update(bookings).set({ status: decision, updatedAt: new Date() }).where(eq(bookings.id, b.id));

  await logBookingActivity(b.id, decision === "accepted" ? "confirmed" : "rejected", {
    actor: "host",
    message: decision === "accepted" ? "Booking approved by host" : "Booking declined by host",
  });

  const ats = await db.select().from(attendees).where(and(eq(attendees.bookingId, b.id), eq(attendees.isPrimary, true)));
  const primary = ats[0];
  if (primary) {
    if (decision === "accepted") {
      const ics = generateIcs({
        uid: bookingIcalUid(uid),
        start: b.startTime,
        end: b.endTime,
        summary: b.title,
        location: b.meetingUrl ?? b.location ?? undefined,
        attendees: [{ name: primary.name, email: primary.email }],
        status: "CONFIRMED",
      });
      const view: EmailBookingView = {
        title: b.title,
        start: b.startTime,
        end: b.endTime,
        timeZone: primary.timeZone,
        hostName: "your host",
        attendeeName: primary.name,
        location: b.location ?? "Online",
        meetingUrl: b.meetingUrl,
        manageUrl: `${env.appUrl}/booking/${uid}`,
      };
      const m = bookingConfirmedAttendee(view);
      await sendMail({ to: primary.email, subject: m.subject, html: m.html, icalEvent: { method: "REQUEST", content: ics } });
    }
  }

  await dispatchWebhook(hostUserId, decision === "accepted" ? "booking_created" : "booking_rejected", { uid });
  return { ok: true, uid };
}

/** Fetch a booking with attendees for the public manage page. */
export async function getBookingByUid(uid: string) {
  const [b] = await db.select().from(bookings).where(eq(bookings.uid, uid)).limit(1);
  if (!b) return null;
  const ats = await db.select().from(attendees).where(eq(attendees.bookingId, b.id));
  let host: { username: string; name: string | null } | null = null;
  let slug: string | null = null;
  if (b.userId) {
    const [u] = await db.select({ username: users.username, name: users.name }).from(users).where(eq(users.id, b.userId)).limit(1);
    host = u ?? null;
  }
  if (b.eventTypeId) {
    const [et] = await db.select({ slug: eventTypes.slug }).from(eventTypes).where(eq(eventTypes.id, b.eventTypeId)).limit(1);
    slug = et?.slug ?? null;
  }
  return { booking: b, attendees: ats, host, slug };
}
