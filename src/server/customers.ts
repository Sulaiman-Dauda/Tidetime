import "server-only";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, memberships } from "@/db/schema";
import { can } from "@/lib/rbac";

export interface CustomerRow {
  id: number;
  email: string;
  name: string;
  phoneNumber: string | null;
  timeZone: string | null;
  bookingsCount: number;
  lastBookingAt: Date | null;
  createdAt: Date;
}

const CUSTOMER_COLUMNS = {
  id: customers.id,
  email: customers.email,
  name: customers.name,
  phoneNumber: customers.phoneNumber,
  timeZone: customers.timeZone,
  bookingsCount: customers.bookingsCount,
  lastBookingAt: customers.lastBookingAt,
  createdAt: customers.createdAt,
} as const;

/** Record a customer once per company, regardless of assigned provider. */
export async function upsertCustomerFromBooking(input: {
  teamId: number;
  email: string;
  name: string;
  phoneNumber?: string | null;
  timeZone?: string | null;
  bookedAt: Date;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email) return;

  await db
    .insert(customers)
    .values({
      teamId: input.teamId,
      email,
      name: input.name,
      phoneNumber: input.phoneNumber ?? null,
      timeZone: input.timeZone ?? null,
      bookingsCount: 1,
      lastBookingAt: input.bookedAt,
    })
    .onConflictDoUpdate({
      target: [customers.teamId, customers.email],
      set: {
        name: input.name,
        phoneNumber: sql`coalesce(${input.phoneNumber ?? null}, ${customers.phoneNumber})`,
        timeZone: sql`coalesce(${input.timeZone ?? null}, ${customers.timeZone})`,
        bookingsCount: sql`${customers.bookingsCount} + 1`,
        lastBookingAt: input.bookedAt,
      },
    });
}

/** List the company-wide customer directory for an authorized actor. */
export async function listCustomersForActor(opts: {
  userId: number;
  search?: string;
}): Promise<CustomerRow[]> {
  const [membership] = await db
    .select({ teamId: memberships.teamId, role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, opts.userId), eq(memberships.accepted, true)))
    .orderBy(asc(memberships.id))
    .limit(1);
  if (!membership || !can(membership.role, "customer.all.view")) return [];

  const filters = [eq(customers.teamId, membership.teamId)];
  const search = opts.search?.trim();
  if (search) {
    const like = `%${search}%`;
    filters.push(or(ilike(customers.name, like), ilike(customers.email, like))!);
  }

  return db
    .select(CUSTOMER_COLUMNS)
    .from(customers)
    .where(and(...filters))
    .orderBy(desc(customers.lastBookingAt), desc(customers.createdAt));
}
