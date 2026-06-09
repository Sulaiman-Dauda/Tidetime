import "server-only";
import { db } from "@/db";
import { customers, memberships } from "@/db/schema";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getCustomerFieldDefs } from "./customer-fields";
import { validateCustomerFieldValues } from "@/lib/customer-fields";

export interface CustomerRow {
  id: number;
  email: string;
  name: string;
  phoneNumber: string | null;
  timeZone: string | null;
  notes: string | null;
  customFields: Record<string, string>;
  bookingsCount: number;
  noShowCount: number;
  lastBookingAt: Date | null;
  createdAt: Date;
}

const CUSTOMER_COLUMNS = {
  id: customers.id,
  email: customers.email,
  name: customers.name,
  phoneNumber: customers.phoneNumber,
  timeZone: customers.timeZone,
  notes: customers.notes,
  customFields: customers.customFields,
  bookingsCount: customers.bookingsCount,
  noShowCount: customers.noShowCount,
  lastBookingAt: customers.lastBookingAt,
  createdAt: customers.createdAt,
} as const;

/** Roles that can see every customer booked under their team, not just their own. */
const TEAM_WIDE_CUSTOMER_ROLES = ["owner", "admin", "manager", "receptionist"] as const;

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

/** List a provider's own customers, newest activity first, with optional search. */
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
    .select(CUSTOMER_COLUMNS)
    .from(customers)
    .where(and(...filters))
    .orderBy(desc(customers.lastBookingAt), desc(customers.createdAt));
}

/**
 * List the customers an actor may see (per-provider visibility, stolen from
 * EasyAppointments): a provider/member sees only their own customers, while a
 * front-desk role (owner/admin/manager/receptionist) sees everyone booked under
 * their team. Always includes the actor's personally-owned customers.
 */
export async function listCustomersForActor(opts: {
  userId: number;
  search?: string;
}): Promise<CustomerRow[]> {
  const mems = await db
    .select({ teamId: memberships.teamId, role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, opts.userId), eq(memberships.accepted, true)));
  const frontDeskTeamIds = mems
    .filter((m) => (TEAM_WIDE_CUSTOMER_ROLES as readonly string[]).includes(m.role))
    .map((m) => m.teamId);

  const scope =
    frontDeskTeamIds.length > 0
      ? or(eq(customers.userId, opts.userId), inArray(customers.teamId, frontDeskTeamIds))!
      : eq(customers.userId, opts.userId);

  let where = scope;
  const search = opts.search?.trim();
  if (search) {
    const like = `%${search}%`;
    where = and(scope, or(ilike(customers.name, like), ilike(customers.email, like))!)!;
  }

  return db
    .select(CUSTOMER_COLUMNS)
    .from(customers)
    .where(where)
    .orderBy(desc(customers.lastBookingAt), desc(customers.createdAt));
}

/**
 * Update editable customer details (notes + custom fields). Scoped so a user can
 * only edit a customer they own or one in a team where they have front-desk
 * access. Custom-field answers are validated against the current definitions.
 */
export async function updateCustomerDetails(
  actorUserId: number,
  customerId: number,
  input: { notes?: string | null; customFields?: Record<string, unknown> },
): Promise<{ ok: boolean; error?: string }> {
  const [existing] = await db
    .select({ id: customers.id, userId: customers.userId, teamId: customers.teamId })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  if (!existing) return { ok: false, error: "Customer not found" };

  // Authorize: own it, or front-desk in its team.
  let allowed = existing.userId === actorUserId;
  if (!allowed && existing.teamId != null) {
    const [m] = await db
      .select({ role: memberships.role })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, actorUserId),
          eq(memberships.teamId, existing.teamId),
          eq(memberships.accepted, true),
        ),
      )
      .limit(1);
    allowed = !!m && (TEAM_WIDE_CUSTOMER_ROLES as readonly string[]).includes(m.role);
  }
  if (!allowed) return { ok: false, error: "Not allowed" };

  const patch: { notes?: string | null; customFields?: Record<string, string> } = {};
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.customFields !== undefined) {
    const defs = await getCustomerFieldDefs();
    const result = validateCustomerFieldValues(defs, input.customFields);
    if (!result.ok) {
      return { ok: false, error: Object.values(result.errors)[0] ?? "Invalid custom field" };
    }
    patch.customFields = result.values;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  await db.update(customers).set(patch).where(eq(customers.id, customerId));
  return { ok: true };
}
