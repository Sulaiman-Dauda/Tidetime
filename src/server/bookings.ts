import "server-only";
import { and, eq, gte, lt, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, attendees, bookingHosts, eventTypes, eventTypeHosts, teams, users, bookingReferences, type BookingField } from "@/db/schema";
import { checkTeamCapacity, CAPACITY_MESSAGES, type CapacityRule } from "@/lib/team-availability";
import { shortId } from "@/lib/crypto";
import {
  getPublicEventType,
  isSlotBookable,
  hostHasConflict,
  slotBookingCount,
  bookingLimitExceeded,
  type ResolvedEventType,
} from "./availability";
import { resolveLocation } from "@/lib/locations";
import { sendMail } from "./mailer";
import {
  bookingCancelledAttendee,
  bookingSeriesConfirmedAttendee,
  type EmailBookingView,
} from "./emails";
import { dispatchWebhook } from "./webhooks";
import { assignTeamHosts } from "./round-robin";
import { scheduleRemindersForBooking, cancelRemindersForBooking } from "./reminders";
import { createBookingPayment, refundBookingPayment } from "./stripe";
import { resolveBookingLink, consumeBookingLink } from "./booking-links";
import { getTeamEventType } from "./teams-public";
import { deleteCalendarEvent } from "./calendar";
import { isStandaloneConferenceRef, teardownStandaloneConference } from "@/app-store/conferencing";
import { isModerationEnabled, moderateFields } from "./moderation";
import { validateResponses as validateFieldResponses, type FieldValues } from "@/lib/booking-fields";
import { normalizeRecurringRule, expandRecurrence } from "@/lib/recurrence";
import { logBookingActivity } from "./activity";
import { upsertCustomerFromBooking } from "./customers";
import { getAppUrl } from "@/server/app-url";
import { isValidTimeZone, formatDateKey, addDaysToKey, zonedTimeToUtc } from "@/lib/time";
import {
  runAcceptedBookingEffects,
  runPendingApprovalEffects,
  runBookingMovedEffects,
  rescheduleRootUid,
} from "./booking-effects";
import { expireStalePaymentHolds } from "./payment-holds";
import { generateIcs, bookingIcalUid } from "@/lib/ics";

// Distinct namespaces for the two-argument form of pg_advisory_xact_lock so a
// host id and an event-type id never collide on the same lock key.
const BOOKING_HOST_LOCK_NS = 8174;
const BOOKING_SEAT_LOCK_NS = 8175;

export interface CreateBookingInput {
  username: string;
  slug: string;
  /** when set, resolves a team service by team slug instead of a user handle */
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
  /** booker chose a specific team host instead of "any available" */
  preferredHostId?: number;
  /**
   * Host-initiated manual booking (e.g. dragging on the dashboard calendar).
   * Skips public guards the host is deliberately overriding — slot availability,
   * required-field validation, moderation, payment, and approval — and confirms
   * the booking immediately. Never set from a public/untrusted code path.
   */
  force?: boolean;
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

async function buildEmailView(args: {
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
}): Promise<EmailBookingView> {
  const appUrl = await getAppUrl();
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
    manageUrl: `${appUrl}/booking/${args.uid}`,
    hour12: args.hour12,
  };
}

/** Load the first host attached to a team service (placeholder before assignment). */
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
  timeZone: string,
): Promise<{ bookingsOnDay: number; concurrentBookings: number }> {
  // "Per day" is measured against the team service's local calendar day, not
  // the UTC day, so the daily cap resets at local midnight for teams away from UTC.
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const key = formatDateKey(start, tz);
  const [y, m, d] = key.split("-").map(Number);
  const next = addDaysToKey(key, 1).split("-").map(Number);
  const dayStart = zonedTimeToUtc(y, m, d, 0, 0, tz);
  const dayEnd = zonedTimeToUtc(next[0], next[1], next[2], 0, 0, tz);

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
    if (!teamResolved) return { ok: false, error: "Service not found" };
    eventType = teamResolved.eventType;
    teamCapacity = {
      teamId: teamResolved.team.id,
      rule: {
        maxBookingsPerDay: teamResolved.team.maxBookingsPerDay,
        maxConcurrentBookings: teamResolved.team.maxConcurrentBookings,
      },
    };
    // Team services assign their host below; seed a placeholder from the first host.
    const placeholder = await firstTeamHost(eventType.id);
    if (!placeholder) return { ok: false, error: "This team service has no hosts" };
    host = placeholder;
    eventType = { ...eventType, userId: placeholder.id };
  } else {
    const resolved = await getPublicEventType(input.username, input.slug);
    if (!resolved) return { ok: false, error: "Service not found" };
    eventType = resolved.eventType;
    host = resolved.host;
  }

  // Validate a temporary booking link, if one was used.
  if (input.bookingLinkToken) {
    const link = await resolveBookingLink(input.bookingLinkToken, input.email);
    if (!link.ok) return { ok: false, error: link.error };
    if (link.link && link.link.eventTypeId !== eventType.id) {
      return { ok: false, error: "This link is for a different service" };
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

  if (!input.force) {
    const validationError = validateResponses(eventType.bookingFields, input.responses);
    if (validationError) return { ok: false, error: validationError };
  }

  // Optional AI moderation of public free-text (no-op unless configured). Host
  // manual bookings are trusted input, so moderation is skipped for them.
  if (!input.force && isModerationEnabled()) {
    const freeText = [
      input.name,
      ...Object.values(input.responses ?? {}).map((v) =>
        typeof v === "string" ? v : Array.isArray(v) ? v.join(" ") : "",
      ),
    ];
    const moderation = await moderateFields(freeText);
    if (moderation.flagged) {
      return { ok: false, error: "Your submission couldn't be accepted. Please revise and try again." };
    }
  }

  // Race-safe availability check. Team services validate per-host during assignment.
  const isTeamEvent =
    eventType.schedulingType === "round_robin" || eventType.schedulingType === "collective";
  if (!isTeamEvent && !input.force) {
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
    const usage = await teamCapacityUsage(teamCapacity.teamId, start, end, eventType.scheduleTimeZone);
    const capacity = checkTeamCapacity(teamCapacity.rule, usage);
    if (!capacity.ok) return { ok: false, error: CAPACITY_MESSAGES[capacity.reason] };
  }

  // Enforce the host's per-day/week/month/year frequency caps. Host manual
  // bookings (force) bypass, matching the availability check above.
  if (!input.force) {
    const exceededPeriod = await bookingLimitExceeded(eventType, start, input.rescheduleUid);
    if (exceededPeriod) {
      return { ok: false, error: "This service has reached its booking limit for that period" };
    }
  }

  // Team scheduling: pick the host(s) for this slot via round-robin/collective.
  let assignedUserId = eventType.userId;
  let assignedHost = { id: host.id, name: host.name, username: host.username };
  // Extra staff (collective / multi-attendant) attached to this booking, so
  // they're marked busy and not double-booked. Empty for solo services.
  let coHostUserIds: number[] = [];
  if (eventType.schedulingType === "round_robin" || eventType.schedulingType === "collective") {
    const assignment = await assignTeamHosts(
      eventType.id,
      eventType.schedulingType,
      eventType.roundRobinMode,
      start,
      end,
      eventType.scheduleTimeZone,
      input.preferredHostId,
      eventType.requiredHosts,
    );
    if (!assignment) {
      return {
        ok: false,
        error: input.preferredHostId
          ? "That host isn't available for the selected time. Try another time or pick “Any available”."
          : "No host is available for that time",
      };
    }
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
  // uid is needed up-front so the built-in Jitsi room can be derived from it.
  const uid = shortId(12);
  const { location, meetingUrl } = resolveLocation(eventType.locations[0], attendeePhone, uid);

  // Host manual bookings (force) skip payment + approval and confirm directly.
  const needsPayment = !input.force && eventType.requiresPayment && eventType.price > 0;

  // Paid bookings stay pending until payment succeeds. If confirmation is also
  // required, they remain pending after payment and only move to accepted when
  // the host approves them.
  const status =
    needsPayment || (!input.force && eventType.requiresConfirmation) ? "pending" : "accepted";
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

  // A reschedule inherits the prior booking's iCalendar SEQUENCE + 1, so the
  // confirmation .ics supersedes the attendee's existing calendar entry.
  let sequence = 0;
  if (input.rescheduleUid) {
    const [orig] = await db
      .select({ sequence: bookings.sequence })
      .from(bookings)
      .where(eq(bookings.uid, input.rescheduleUid))
      .limit(1);
    sequence = (orig?.sequence ?? 0) + 1;
  }

  // Persist booking + attendees in a transaction. We take a Postgres
  // transaction-level advisory lock and re-verify availability *inside* it so
  // the check and the insert are atomic: two concurrent bookers racing for the
  // same slot serialize on the lock, and the second sees the first's committed
  // booking and is rejected. The lock auto-releases on commit/rollback. Group
  // events lock on the event type (seat capacity is per-slot); everything else
  // locks on the assigned host. `force` (trusted host manual bookings) skips
  // the re-check, matching the earlier slot check.
  const seatsPerSlot = eventType.seatsPerTimeSlot ?? 1;
  const txResult = await db.transaction(async (tx): Promise<{ id: number } | { conflict: true }> => {
    if (seatsPerSlot > 1) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${BOOKING_SEAT_LOCK_NS}, ${eventType.id})`);
    } else {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${BOOKING_HOST_LOCK_NS}, ${assignedUserId ?? eventType.id})`);
    }

    if (!input.force) {
      if (seatsPerSlot > 1) {
        if ((await slotBookingCount(eventType.id, start)) >= seatsPerSlot) return { conflict: true };
      } else if (assignedUserId != null) {
        if (await hostHasConflict(assignedUserId, start, end)) return { conflict: true };
        for (const coId of coHostUserIds) {
          if (await hostHasConflict(coId, start, end)) return { conflict: true };
        }
      }
    }

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
        sequence,
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

    // Record co-hosts so collective / multi-attendant staff are marked busy.
    if (coHostUserIds.length > 0) {
      await tx
        .insert(bookingHosts)
        .values(coHostUserIds.map((userId) => ({ bookingId: b.id, userId })));
    }
    return { id: b.id };
  });

  if ("conflict" in txResult) {
    return { ok: false, error: "That time is no longer available" };
  }
  const bookingId = txResult.id;

  const tasks: Promise<unknown>[] = [
    logBookingActivity(bookingId, input.rescheduleUid ? "rescheduled" : "created", {
      actor: input.name,
      message: input.rescheduleUid ? "Rescheduled to a new time" : `Booked by ${input.name}`,
    }),
    upsertCustomerFromBooking({
      userId: assignedUserId,
      teamId: teamCapacity?.teamId ?? null,
      email: input.email,
      name: input.name,
      phoneNumber: attendeePhone ?? null,
      timeZone: input.timeZone,
      bookedAt: start,
    }),
  ];
  await Promise.allSettled(tasks);

  // Paid events: create a Stripe PaymentIntent. The slot is held for checkout,
  // but the booking only moves forward once payment succeeds.
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
      await db
        .update(bookings)
        .set({ status: "cancelled", cancellationReason: "Payment setup failed" })
        .where(eq(bookings.id, bookingId));
      return { ok: false, error: pay.error ?? "Could not start payment" };
    }
    if (input.bookingLinkToken) {
      await consumeBookingLink(input.bookingLinkToken);
    }
    return { ok: true, uid, requiresPayment: true, paymentClientSecret: pay.clientSecret };
  }

  if (input.bookingLinkToken) {
    await consumeBookingLink(input.bookingLinkToken);
  }

  if (status === "accepted") {
    await runAcceptedBookingEffects(bookingId);
  } else {
    await runPendingApprovalEffects(bookingId);
  }

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

  // Persist all occurrences in a single transaction, serialized per-host and
  // re-checking each occurrence inside the lock (same race guard as createBooking).
  const created = await db.transaction(async (tx) => {
    if (assignedUserId != null) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${BOOKING_HOST_LOCK_NS}, ${assignedUserId})`);
    }
    const rows: { id: number; uid: string; start: Date; end: Date }[] = [];
    for (const occ of bookable) {
      if (assignedUserId != null && (await hostHasConflict(assignedUserId, occ.start, occ.end))) {
        continue;
      }
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

  if (created.length === 0) return { ok: false, error: "That time is no longer available" };

  // Per-occurrence side effects: reminders + activity log.
  for (const row of created) {
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
  const baseView = await buildEmailView({
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
  const a = await bookingSeriesConfirmedAttendee(baseView, seriesDates, input.timeZone, true, status);
  tasks.push(sendMail({ to: input.email, subject: a.subject, html: a.html }));
  if (hostUser) {
    const hostView = await buildEmailView({
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
    const h = await bookingSeriesConfirmedAttendee(hostView, seriesDates, eventType.hostTimeZone, hour12, status);
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

  // Bump the iCalendar SEQUENCE so the CANCEL we email actually supersedes the
  // attendee's existing calendar entry (lower/equal sequences are ignored).
  const nextSequence = b.sequence + 1;
  await db
    .update(bookings)
    .set({
      status: "cancelled",
      cancellationReason: reason ?? null,
      cancelledByEmail: cancelledByEmail ?? null,
      sequence: nextSequence,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, b.id));

  await cancelRemindersForBooking(b.id);
  await logBookingActivity(b.id, "cancelled", {
    actor: cancelledByEmail ?? "attendee",
    message: reason ? `Cancelled: ${reason}` : "Booking cancelled",
  });

  // Delete external calendar events for this booking across every provider (best-effort).
  if (b.userId) {
    const refs = await db
      .select({
        type: bookingReferences.type,
        uid: bookingReferences.uid,
        externalCalendarId: bookingReferences.externalCalendarId,
      })
      .from(bookingReferences)
      .where(eq(bookingReferences.bookingId, b.id));
    for (const ref of refs) {
      if (isStandaloneConferenceRef(ref.type)) {
        await teardownStandaloneConference(b.userId, ref.type, ref.uid);
        continue;
      }
      await deleteCalendarEvent(b.userId, ref.type, ref.uid, ref.externalCalendarId).catch(
        () => undefined,
      );
    }
    if (refs.length > 0) {
      await db.delete(bookingReferences).where(eq(bookingReferences.bookingId, b.id));
    }
  }

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
      manageUrl: `${await getAppUrl()}/booking/${uid}`,
    };
    const m = await bookingCancelledAttendee(view, reason);
    // Attach a CANCEL .ics (stable chain UID + bumped SEQUENCE) so the meeting
    // is actually removed from the attendee's calendar, not just emailed about.
    const cancelIcs = generateIcs({
      uid: bookingIcalUid(await rescheduleRootUid(b.uid, b.rescheduledFromUid)),
      start: b.startTime,
      end: b.endTime,
      summary: et?.title ?? b.title,
      attendees: [{ name: primary.name, email: primary.email }],
      status: "CANCELLED",
      sequence: nextSequence,
    });
    await sendMail({
      to: primary.email,
      subject: m.subject,
      html: m.html,
      icalEvent: { method: "CANCEL", content: cancelIcs },
    });
  }

  if (b.userId) {
    await dispatchWebhook(b.userId, "booking_cancelled", { uid, reason: reason ?? null });
  }

  return { ok: true, uid };
}

/**
 * Move an accepted/pending booking to a new start time (host action — e.g. drag
 * on the dashboard calendar). Keeps the duration, validates the host owns it,
 * bumps the iCalendar SEQUENCE, and refreshes calendar/email/reminders.
 */
export async function moveBooking(
  uid: string,
  hostUserId: number,
  newStartIso: string,
): Promise<BookingResult> {
  const start = new Date(newStartIso);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Invalid time" };

  const [b] = await db.select().from(bookings).where(eq(bookings.uid, uid)).limit(1);
  if (!b || b.userId !== hostUserId) return { ok: false, error: "Booking not found" };
  if (b.status !== "accepted" && b.status !== "pending") {
    return { ok: false, error: "Only active bookings can be moved" };
  }

  const durationMs = b.endTime.getTime() - b.startTime.getTime();
  const end = new Date(start.getTime() + durationMs);
  if (start.getTime() === b.startTime.getTime()) return { ok: true, uid };

  const nextSequence = b.sequence + 1;
  await db
    .update(bookings)
    .set({ startTime: start, endTime: end, sequence: nextSequence, updatedAt: new Date() })
    .where(eq(bookings.id, b.id));

  await logBookingActivity(b.id, "rescheduled", {
    actor: "host",
    message: "Moved on the calendar",
    data: { from: b.startTime.toISOString(), to: start.toISOString() },
  });

  if (b.status === "accepted") {
    await runBookingMovedEffects(b.id).catch(() => undefined);
  }
  return { ok: true, uid };
}

/** Approve or reject a pending booking (host action). */
export async function decideBooking(uid: string, decision: "accepted" | "rejected", hostUserId: number): Promise<BookingResult> {
  const [b] = await db.select().from(bookings).where(eq(bookings.uid, uid)).limit(1);
  if (!b || b.userId !== hostUserId) return { ok: false, error: "Not found" };
  if (b.status !== "pending") return { ok: false, error: "Booking is not pending" };

  const [et] = b.eventTypeId
    ? await db
        .select({ requiresPayment: eventTypes.requiresPayment })
        .from(eventTypes)
        .where(eq(eventTypes.id, b.eventTypeId))
        .limit(1)
    : [{ requiresPayment: false }];

  if (decision === "accepted" && et?.requiresPayment && !b.paid) {
    return { ok: false, error: "This booking is still waiting for payment" };
  }

  await db.update(bookings).set({ status: decision, updatedAt: new Date() }).where(eq(bookings.id, b.id));

  await logBookingActivity(b.id, decision === "accepted" ? "confirmed" : "rejected", {
    actor: "host",
    message: decision === "accepted" ? "Booking approved by host" : "Booking declined by host",
  });

  if (decision === "accepted") {
    await runAcceptedBookingEffects(b.id);
  } else {
    if (b.paid) {
      await refundBookingPayment(b.id).catch(() => undefined);
    }
    await dispatchWebhook(hostUserId, "booking_rejected", { uid });
  }

  return { ok: true, uid };
}

/** Fetch a booking with attendees for the public manage page. */
export async function getBookingByUid(uid: string) {
  await expireStalePaymentHolds();
  const [b] = await db.select().from(bookings).where(eq(bookings.uid, uid)).limit(1);
  if (!b) return null;
  const ats = await db.select().from(attendees).where(eq(attendees.bookingId, b.id));
  let host: { username: string; name: string | null; avatarUrl: string | null } | null = null;
  let slug: string | null = null;
  let team: { slug: string; name: string } | null = null;
  let eventTypeMeta: { requiresPayment: boolean } | null = null;
  if (b.userId) {
    const [u] = await db.select({ username: users.username, name: users.name, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, b.userId)).limit(1);
    host = u ?? null;
  }
  if (b.eventTypeId) {
    const [et] = await db
      .select({ slug: eventTypes.slug, teamId: eventTypes.teamId, requiresPayment: eventTypes.requiresPayment })
      .from(eventTypes)
      .where(eq(eventTypes.id, b.eventTypeId))
      .limit(1);
    slug = et?.slug ?? null;
    eventTypeMeta = et ? { requiresPayment: et.requiresPayment } : null;

    if (et?.teamId) {
      const [teamRow] = await db
        .select({ slug: teams.slug, name: teams.name })
        .from(teams)
        .where(eq(teams.id, et.teamId))
        .limit(1);
      team = teamRow ?? null;
    }
  }
  return { booking: b, attendees: ats, host, slug, team, eventType: eventTypeMeta };
}
