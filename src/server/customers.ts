import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { attendees, bookings, customers, services } from "@/db/schema";

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

export type CustomerSort = "recent" | "name" | "bookings";

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

/** A cancelled booking shouldn't keep inflating the customer's tally. */
export async function decrementCustomerBookingCount(teamId: number, email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  await db
    .update(customers)
    .set({ bookingsCount: sql`greatest(${customers.bookingsCount} - 1, 0)` })
    .where(and(eq(customers.teamId, teamId), eq(customers.email, normalized)));
}

export interface CustomerListResult {
  rows: CustomerRow[];
  total: number;
}

/** Company-wide customer directory. Caller is responsible for authorization. */
export async function listCustomers(opts: {
  teamId: number;
  search?: string;
  sort?: CustomerSort;
  page?: number;
  pageSize?: number;
}): Promise<CustomerListResult> {
  const filters = [eq(customers.teamId, opts.teamId)];
  const search = opts.search?.trim();
  if (search) {
    const like = `%${search}%`;
    filters.push(
      or(
        ilike(customers.name, like),
        ilike(customers.email, like),
        ilike(customers.phoneNumber, like),
      )!,
    );
  }
  const where = and(...filters);

  const orderBy =
    opts.sort === "name"
      ? [asc(customers.name), asc(customers.email)]
      : opts.sort === "bookings"
        ? [desc(customers.bookingsCount), desc(customers.lastBookingAt)]
        : [desc(customers.lastBookingAt), desc(customers.createdAt)];

  const pageSize = opts.pageSize ?? 50;
  const page = Math.max(1, opts.page ?? 1);

  const [[{ value: total } = { value: 0 }], rows] = await Promise.all([
    db.select({ value: count() }).from(customers).where(where),
    db
      .select(CUSTOMER_COLUMNS)
      .from(customers)
      .where(where)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return { rows, total };
}

/** One customer + their booking history with this company. */
export async function getCustomerWithBookings(teamId: number, customerId: number) {
  const [customer] = await db
    .select(CUSTOMER_COLUMNS)
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.teamId, teamId)))
    .limit(1);
  if (!customer) return null;

  // Bookings where this customer is an attendee, scoped to the company's
  // services (the attendee's email is the join key the directory dedupes by).
  const attendeeRows = await db
    .select({ bookingId: attendees.bookingId })
    .from(attendees)
    .where(eq(attendees.email, customer.email));
  const ids = attendeeRows.map((r) => r.bookingId);
  const history = ids.length
    ? await db
        .select({
          uid: bookings.uid,
          title: bookings.title,
          serviceTitle: services.title,
          startTime: bookings.startTime,
          endTime: bookings.endTime,
          status: bookings.status,
          location: bookings.location,
        })
        .from(bookings)
        .leftJoin(services, eq(services.id, bookings.serviceId))
        .where(and(inArray(bookings.id, ids), eq(services.teamId, teamId)))
        .orderBy(desc(bookings.startTime))
        .limit(100)
    : [];

  return { customer, history };
}

/** Remove a customer record (their bookings are untouched). */
export async function deleteCustomer(teamId: number, customerId: number): Promise<void> {
  await db
    .delete(customers)
    .where(and(eq(customers.id, customerId), eq(customers.teamId, teamId)));
}
