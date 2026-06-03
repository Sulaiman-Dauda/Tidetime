import "server-only";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

export interface CustomerRow {
  id: number;
  email: string;
  name: string;
  phoneNumber: string | null;
  timeZone: string | null;
  notes: string | null;
  bookingsCount: number;
  noShowCount: number;
  lastBookingAt: Date | null;
  createdAt: Date;
}

/**
 * Record (or update) a customer derived from a confirmed booking. Customers are
 * de-duplicated by (provider, email). Best-effort: scoped to a host user so the
 * (userId, email) unique index can resolve the conflict.
 */
export async function upsertCustomerFromBooking(input: {
  userId: number | null;
  teamId?: number | null;
  email: string;
  name: string;
  phoneNumber?: string | null;
  timeZone?: string | null;
  bookedAt: Date;
}): Promise<void> {
  if (!input.userId) return;
  const email = input.email.trim().toLowerCase();
  if (!email) return;
  await db
    .insert(customers)
    .values({
      userId: input.userId,
      teamId: input.teamId ?? null,
      email,
      name: input.name,
      phoneNumber: input.phoneNumber ?? null,
      timeZone: input.timeZone ?? null,
      bookingsCount: 1,
      lastBookingAt: input.bookedAt,
    })
    .onConflictDoUpdate({
      target: [customers.userId, customers.email],
      set: {
        name: input.name,
        phoneNumber: sql`coalesce(${input.phoneNumber ?? null}, ${customers.phoneNumber})`,
        timeZone: sql`coalesce(${input.timeZone ?? null}, ${customers.timeZone})`,
        bookingsCount: sql`${customers.bookingsCount} + 1`,
        lastBookingAt: input.bookedAt,
      },
    });
}

/** List a provider's customers, newest activity first, with optional search. */
export async function listCustomers(opts: {
  userId: number;
  search?: string;
}): Promise<CustomerRow[]> {
  const filters = [eq(customers.userId, opts.userId)];
  const search = opts.search?.trim();
  if (search) {
    const like = `%${search}%`;
    filters.push(or(ilike(customers.name, like), ilike(customers.email, like))!);
  }
  return db
    .select({
      id: customers.id,
      email: customers.email,
      name: customers.name,
      phoneNumber: customers.phoneNumber,
      timeZone: customers.timeZone,
      notes: customers.notes,
      bookingsCount: customers.bookingsCount,
      noShowCount: customers.noShowCount,
      lastBookingAt: customers.lastBookingAt,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .where(and(...filters))
    .orderBy(desc(customers.lastBookingAt), desc(customers.createdAt));
}
