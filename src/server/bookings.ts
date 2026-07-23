import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, attendees, services, serviceProviders, teams, users, bookingReferences, type BookingField } from "@/db/schema";
import { shortId } from "@/lib/crypto";
import { hostHasConflict, type ResolvedService } from "./availability";
import { resolveLocation } from "@/lib/locations";
import { sendMail } from "./mailer";
import { bookingCancelledAttendee, type EmailBookingView } from "./emails";
import { dispatchWebhook } from "./webhooks";
import { assignTeamHost } from "./round-robin";
import { getTeamService } from "./teams-public";
import { deleteCalendarEvent } from "./calendar";
import { validateResponses as validateFieldResponses, type FieldValues } from "@/lib/booking-fields";
import { logBookingActivity } from "./activity";
import { upsertCustomerFromBooking } from "./customers";
import { getAppUrl } from "@/server/app-url";
import { isValidTimeZone } from "@/lib/time";
import {
  runAcceptedBookingEffects,
  runPendingApprovalEffects,
  runBookingMovedEffects,
  rescheduleRootUid,
} from "./booking-effects";
import { generateIcs, bookingIcalUid } from "@/lib/ics";

// Distinct namespaces for advisory locks keep host and idempotency keys separate.
const BOOKING_HOST_LOCK_NS = 8174;
const BOOKING_IDEMPOTENCY_LOCK_NS = 8175;

export interface CreateBookingInput {
  teamSlug: string;
  slug: string;
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
  /** booker chose a specific team host instead of "any available" */
  preferredHostId?: number;
  /**
   * Host-initiated manual booking (e.g. dragging on the dashboard calendar).
   * Skips public guards the host is deliberately overriding — slot availability,
   * required-field validation and approval — and confirms
   * the booking immediately. Never set from a public/untrusted code path.
   */
  force?: boolean;
}

export interface BookingResult {
  ok: boolean;
  uid?: string;
  error?: string;
  /** machine-readable failure kind — "slot_taken" lets the UI recover gracefully */
  code?: "slot_taken";
}

function validateResponses(fields: BookingField[], responses: Record<string, unknown>): string | null {
  const errors = validateFieldResponses(fields, responses as FieldValues);
  const first = Object.values(errors)[0];
  return first ?? null;
}

/** Load one assigned provider so the service can be rejected early when empty. */
async function firstAssignedProvider(
  serviceId: number,
): Promise<{ id: number; name: string | null; username: string } | null> {
  const [row] = await db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(serviceProviders)
    .innerJoin(users, eq(serviceProviders.userId, users.id))
    .where(eq(serviceProviders.serviceId, serviceId))
    .limit(1);
  return row ?? null;
}

/** Create a new booking with full validation, persistence, notifications. */
export async function createBooking(input: CreateBookingInput): Promise<BookingResult> {
  const teamResolved = await getTeamService(input.teamSlug, input.slug);
  if (!teamResolved) return { ok: false, error: "Service not found" };
  const service: ResolvedService = teamResolved.service;
  const teamId = teamResolved.team.id;
  const initialProvider = await firstAssignedProvider(service.id);
  if (!initialProvider) return { ok: false, error: "This service has no providers" };
  const host: { id: number; name: string | null; username: string } = initialProvider;

  // Idempotency: return the existing booking if this key was already used.
  if (input.idempotencyKey) {
    const [dupe] = await db
      .select({ uid: bookings.uid })
      .from(bookings)
      .where(eq(bookings.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (dupe) return { ok: true, uid: dupe.uid };
  }

  const duration = input.duration ?? service.length;
  if (service.durations.length > 0 && input.duration && !service.durations.includes(input.duration) && input.duration !== service.length) {
    return { ok: false, error: "Invalid duration" };
  }

  if (!isValidTimeZone(input.timeZone)) {
    return { ok: false, error: "Invalid timezone" };
  }

  if (!input.force) {
    const validationError = validateResponses(service.bookingFields, input.responses);
    if (validationError) return { ok: false, error: validationError };
  }

  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "Invalid start time" };
  }
  const end = new Date(start.getTime() + duration * 60000);

  // Assign exactly one available provider.
  let assignedHost = { id: host.id, name: host.name, username: host.username };
  const assignment = await assignTeamHost(
    service.id,
    start,
    end,
    input.preferredHostId,
  );
  if (!assignment) {
    return {
      ok: false,
      error: input.preferredHostId
        ? "That provider isn't available for the selected time. Try another time or pick “Any available”."
        : "No provider is available for that time",
      code: "slot_taken",
    };
  }
  const assignedUserId = assignment;
  const [u] = await db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(users)
    .where(eq(users.id, assignment))
    .limit(1);
  if (u) assignedHost = u;

  // Resolve phone and notes from the field *types*, not hardcoded names — an
  // admin can retype the default "notes" field into a phone question (the
  // internal name stays "notes"), so name-based lookups misfile the answers.
  const responseForType = (type: BookingField["type"]): string | undefined => {
    const field = service.bookingFields.find((f) => !f.system && f.type === type);
    const value = field ? input.responses[field.name] : undefined;
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };
  // Manual dashboard bookings (`force`) submit a bare { notes } that never went
  // through the service's form, so the literal key is authoritative there.
  // Keep a leading "+" and digits only so stored numbers are dialable.
  const rawPhone = input.force ? undefined : responseForType("phone");
  const attendeePhone = rawPhone
    ? `${rawPhone.startsWith("+") ? "+" : ""}${rawPhone.replace(/\D/g, "")}`.slice(0, 32)
    : undefined;
  // uid is needed up-front so the built-in Jitsi room can be derived from it.
  const uid = shortId(12);
  const { location, meetingUrl } = resolveLocation(service.locations[0], attendeePhone, uid);

  const status = !input.force && service.requiresConfirmation ? "pending" : "accepted";
  const notes = input.force
    ? (typeof input.responses.notes === "string" && input.responses.notes.trim() ? input.responses.notes.trim() : null)
    : responseForType("textarea") ?? null;

  // A reschedule inherits the prior booking's iCalendar SEQUENCE + 1, so the
  // confirmation .ics supersedes the attendee's existing calendar entry.
  let sequence = 0;
  if (input.rescheduleUid) {
    const [orig] = await db
      .select({
        serviceId: bookings.serviceId,
        sequence: bookings.sequence,
        status: bookings.status,
      })
      .from(bookings)
      .where(eq(bookings.uid, input.rescheduleUid))
      .limit(1);
    if (
      !orig ||
      orig.serviceId !== service.id ||
      (orig.status !== "accepted" && orig.status !== "pending")
    ) {
      return { ok: false, error: "The booking cannot be rescheduled" };
    }
    sequence = (orig?.sequence ?? 0) + 1;
  }

  // Persist booking + attendees in a transaction. We take a Postgres
  // transaction-level advisory lock and re-verify availability *inside* it so
  // the check and the insert are atomic: two concurrent bookers racing for the
  // same slot serialize on the lock, and the second sees the first's committed
  // booking and is rejected. The lock auto-releases on commit/rollback.
  // `force` (trusted host manual bookings) skips
  // the re-check, matching the earlier slot check.
  const txResult = await db.transaction(async (tx): Promise<
    { id: number } | { conflict: true } | { duplicateUid: string }
  > => {
    if (input.idempotencyKey) {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${BOOKING_IDEMPOTENCY_LOCK_NS}, hashtext(${input.idempotencyKey}))`,
      );
    }
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${BOOKING_HOST_LOCK_NS}, ${assignedUserId})`);

    // The optimistic check above provides a fast path. Re-check while holding
    // the same lock as the insert so simultaneous double-submits cannot race
    // into the unique idempotency constraint and surface as a 500.
    if (input.idempotencyKey) {
      const [duplicate] = await tx
        .select({ uid: bookings.uid })
        .from(bookings)
        .where(eq(bookings.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (duplicate) return { duplicateUid: duplicate.uid };
    }

    if (!input.force) {
      if (await hostHasConflict(assignedUserId, start, end)) return { conflict: true };
    }

    const [b] = await tx
      .insert(bookings)
      .values({
        uid,
        serviceId: service.id,
        userId: assignedUserId,
        title: `${service.title} between ${assignedHost.name ?? assignedHost.username} and ${input.name}`,
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
    if (!service.disableGuests) {
      for (const g of input.guests ?? []) {
        if (g.trim()) attendeeRows.push({ bookingId: b.id, email: g.trim(), name: g.trim(), timeZone: input.timeZone, isPrimary: false });
      }
    }
    await tx.insert(attendees).values(attendeeRows);

    return { id: b.id };
  });

  if ("conflict" in txResult) {
    return { ok: false, error: "That time is no longer available", code: "slot_taken" };
  }
  if ("duplicateUid" in txResult) {
    return { ok: true, uid: txResult.duplicateUid };
  }
  const bookingId = txResult.id;

  const tasks: Promise<unknown>[] = [
    logBookingActivity(bookingId, input.rescheduleUid ? "rescheduled" : "created", {
      actor: input.name,
      message: input.rescheduleUid ? "Rescheduled to a new time" : `Booked by ${input.name}`,
    }),
    upsertCustomerFromBooking({
      teamId,
      email: input.email,
      name: input.name,
      phoneNumber: attendeePhone ?? null,
      timeZone: input.timeZone,
      bookedAt: start,
    }),
  ];
  await Promise.allSettled(tasks);

  if (status === "accepted") {
    await runAcceptedBookingEffects(bookingId);
  } else {
    await runPendingApprovalEffects(bookingId);
  }

  return { ok: true, uid };
}

export async function cancelBooking(
  uid: string,
  reason?: string,
  actor: "attendee" | "host" = "attendee",
): Promise<BookingResult> {
  const [b] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.uid, uid))
    .limit(1);
  if (!b) return { ok: false, error: "Booking not found" };
  if (b.status === "cancelled") return { ok: true, uid };

  // Bump the iCalendar SEQUENCE so the CANCEL we email actually supersedes the
  // attendee's existing calendar entry (lower/equal sequences are ignored).
  const nextSequence = b.sequence + 1;
  await db
    .update(bookings)
    .set({
      status: "cancelled",
      cancellationReason: reason ?? null,
      sequence: nextSequence,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, b.id));

  await logBookingActivity(b.id, "cancelled", {
    actor,
    message: reason ? `Cancelled: ${reason}` : "Booking cancelled",
  });

  // Delete external calendar events for this booking across every provider (best-effort).
  if (b.userId) {
    const refs = await db
      .select({
        eventId: bookingReferences.eventId,
        calendarId: bookingReferences.calendarId,
      })
      .from(bookingReferences)
      .where(eq(bookingReferences.bookingId, b.id));
    for (const ref of refs) {
      await deleteCalendarEvent(b.userId, ref.eventId, ref.calendarId).catch(
        () => undefined,
      );
    }
    if (refs.length > 0) {
      await db.delete(bookingReferences).where(eq(bookingReferences.bookingId, b.id));
    }
  }

  const ats = await db.select().from(attendees).where(eq(attendees.bookingId, b.id));
  const [et] = b.serviceId
    ? await db.select({ title: services.title }).from(services).where(eq(services.id, b.serviceId)).limit(1)
    : [{ title: b.title }];

  const primary = ats.find((a) => a.isPrimary) ?? ats[0];
  if (primary) {
    const [hostUser] = b.userId
      ? await db.select({ name: users.name, username: users.username }).from(users).where(eq(users.id, b.userId)).limit(1)
      : [];
    const view: EmailBookingView = {
      title: et?.title ?? b.title,
      start: b.startTime,
      end: b.endTime,
      timeZone: primary.timeZone,
      hostName: hostUser?.name ?? hostUser?.username ?? "your host",
      attendeeName: primary.name,
      attendeeEmail: primary.email,
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
 * bumps the iCalendar SEQUENCE, and refreshes calendar/email state.
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

  await db.update(bookings).set({ status: decision, updatedAt: new Date() }).where(eq(bookings.id, b.id));

  await logBookingActivity(b.id, decision === "accepted" ? "confirmed" : "rejected", {
    actor: "host",
    message: decision === "accepted" ? "Booking approved by host" : "Booking declined by host",
  });

  if (decision === "accepted") {
    await runAcceptedBookingEffects(b.id);
  } else {
    await dispatchWebhook(hostUserId, "booking_rejected", { uid });
  }

  return { ok: true, uid };
}

/** Fetch a booking with attendees for the public manage page. */
export async function getBookingByUid(uid: string) {
  const [b] = await db.select().from(bookings).where(eq(bookings.uid, uid)).limit(1);
  if (!b) return null;
  const ats = await db.select().from(attendees).where(eq(attendees.bookingId, b.id));
  let host: { username: string; name: string | null; avatarUrl: string | null; position: string | null } | null = null;
  let slug: string | null = null;
  let team: { slug: string; name: string } | null = null;
  let service: { title: string; bookingFields: BookingField[] } | null = null;
  if (b.userId) {
    const [u] = await db.select({ username: users.username, name: users.name, avatarUrl: users.avatarUrl, position: users.position }).from(users).where(eq(users.id, b.userId)).limit(1);
    host = u ?? null;
  }
  if (b.serviceId) {
    const [et] = await db
      .select({ slug: services.slug, teamId: services.teamId, title: services.title, bookingFields: services.bookingFields })
      .from(services)
      .where(eq(services.id, b.serviceId))
      .limit(1);
    slug = et?.slug ?? null;
    service = et ? { title: et.title, bookingFields: et.bookingFields } : null;

    if (et?.teamId) {
      const [teamRow] = await db
        .select({ slug: teams.slug, name: teams.name })
        .from(teams)
        .where(eq(teams.id, et.teamId))
        .limit(1);
      team = teamRow ?? null;
    }
  }
  return { booking: b, attendees: ats, host, slug, team, service };
}
