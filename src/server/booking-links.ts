import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookingLinks, eventTypes } from "@/db/schema";
import { randomToken } from "@/lib/crypto";
import { validateBookingLink, LINK_ERROR_MESSAGES, type BookingLinkKind } from "@/lib/booking-links";

export interface CreateLinkInput {
  eventTypeId: number;
  createdByUserId: number;
  kind: BookingLinkKind;
  maxUses?: number | null;
  expiresAt?: Date | null;
  inviteEmail?: string | null;
}

/** Create a temporary booking link, returning its public token. */
export async function createBookingLink(input: CreateLinkInput): Promise<{ token: string }> {
  const token = randomToken(18);
  await db.insert(bookingLinks).values({
    token,
    eventTypeId: input.eventTypeId,
    createdByUserId: input.createdByUserId,
    kind: input.kind,
    maxUses: input.maxUses ?? null,
    expiresAt: input.expiresAt ?? null,
    inviteEmail: input.inviteEmail ?? null,
  });
  return { token };
}

export interface ResolvedLink {
  ok: boolean;
  error?: string;
  link?: typeof bookingLinks.$inferSelect;
  eventType?: { username: string; slug: string };
}

/** Resolve and validate a booking-link token for public use. */
export async function resolveBookingLink(token: string, attendeeEmail?: string): Promise<ResolvedLink> {
  const [row] = await db.select().from(bookingLinks).where(eq(bookingLinks.token, token)).limit(1);
  if (!row) return { ok: false, error: "Booking link not found" };

  const validation = validateBookingLink(
    {
      kind: row.kind as BookingLinkKind,
      maxUses: row.maxUses,
      usedCount: row.usedCount,
      expiresAt: row.expiresAt,
      inviteEmail: row.inviteEmail,
      revoked: row.revoked,
    },
    new Date(),
    attendeeEmail,
  );
  if (!validation.ok) return { ok: false, error: LINK_ERROR_MESSAGES[validation.reason] };

  return { ok: true, link: row };
}

/** Atomically record a successful use of a booking link. */
export async function consumeBookingLink(token: string): Promise<void> {
  await db
    .update(bookingLinks)
    .set({ usedCount: sql`${bookingLinks.usedCount} + 1` })
    .where(eq(bookingLinks.token, token));
}

/** Revoke a booking link (owner only). */
export async function revokeBookingLink(id: number, ownerUserId: number): Promise<boolean> {
  const result = await db
    .update(bookingLinks)
    .set({ revoked: true })
    .where(and(eq(bookingLinks.id, id), eq(bookingLinks.createdByUserId, ownerUserId)))
    .returning({ id: bookingLinks.id });
  return result.length > 0;
}

/** Verify an event type belongs to a user (for link creation authz). */
export async function userOwnsEventType(userId: number, eventTypeId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: eventTypes.id })
    .from(eventTypes)
    .where(and(eq(eventTypes.id, eventTypeId), eq(eventTypes.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export interface BookingLinkRow {
  id: number;
  token: string;
  kind: BookingLinkKind;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date | null;
  inviteEmail: string | null;
  revoked: boolean;
  createdAt: Date;
  eventTypeTitle: string;
  eventTypeSlug: string;
}

/** List all booking links created by a user, newest first. */
export async function listBookingLinks(userId: number): Promise<BookingLinkRow[]> {
  const rows = await db
    .select({
      id: bookingLinks.id,
      token: bookingLinks.token,
      kind: bookingLinks.kind,
      maxUses: bookingLinks.maxUses,
      usedCount: bookingLinks.usedCount,
      expiresAt: bookingLinks.expiresAt,
      inviteEmail: bookingLinks.inviteEmail,
      revoked: bookingLinks.revoked,
      createdAt: bookingLinks.createdAt,
      eventTypeTitle: eventTypes.title,
      eventTypeSlug: eventTypes.slug,
    })
    .from(bookingLinks)
    .innerJoin(eventTypes, eq(bookingLinks.eventTypeId, eventTypes.id))
    .where(eq(bookingLinks.createdByUserId, userId))
    .orderBy(desc(bookingLinks.createdAt));
  return rows.map((r) => ({ ...r, kind: r.kind as BookingLinkKind }));
}

/** Event types a user can create links for. */
export async function userEventTypesForLinks(
  userId: number,
): Promise<{ id: number; title: string }[]> {
  return db
    .select({ id: eventTypes.id, title: eventTypes.title })
    .from(eventTypes)
    .where(eq(eventTypes.userId, userId))
    .orderBy(eventTypes.title);
}
