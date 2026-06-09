"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { eventTypes, type BookingField, type EventLocation } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getCompanySettings } from "@/server/company-settings";
import {
  bookingFieldsSchema,
  bookingLimitsSchema,
  currencySchema,
  eventLocationsSchema,
  httpUrlSchema,
} from "@/lib/schemas";

const DEFAULT_FIELDS: BookingField[] = [
  { name: "name", label: "Your name", type: "text", required: true, system: true },
  { name: "email", label: "Email address", type: "email", required: true, system: true },
  { name: "notes", label: "Additional notes", type: "textarea", required: false, placeholder: "Anything that will help prepare for the meeting." },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "meeting";
}

async function nextEventTypePosition(userId: number): Promise<number> {
  const [row] = await db
    .select({ position: sql<number>`coalesce(max(${eventTypes.position}), -1)::int` })
    .from(eventTypes)
    .where(eq(eventTypes.userId, userId));
  return (row?.position ?? -1) + 1;
}

async function normalizeEventTypePositions(userId: number): Promise<void> {
  const rows = await db
    .select({ id: eventTypes.id, position: eventTypes.position })
    .from(eventTypes)
    .where(eq(eventTypes.userId, userId))
    .orderBy(asc(eventTypes.position), asc(eventTypes.createdAt), asc(eventTypes.id));

  const needsUpdate = rows.some((row, index) => row.position !== index);
  if (!needsUpdate) return;

  await db.transaction(async (tx) => {
    for (const [index, row] of rows.entries()) {
      if (row.position === index) continue;
      await tx.update(eventTypes).set({ position: index }).where(eq(eventTypes.id, row.id));
    }
  });
}

export async function createEventTypeAction(formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim() || "30 Minute Meeting";
  const length = Math.max(5, Number(formData.get("length") ?? 30));

  // Ensure unique slug per user.
  const base = slugify(title);
  let slug = base;
  let n = 1;
  while (true) {
    const clash = await db
      .select({ id: eventTypes.id })
      .from(eventTypes)
      .where(and(eq(eventTypes.userId, user.id), eq(eventTypes.slug, slug)))
      .limit(1);
    if (clash.length === 0) break;
    slug = `${base}-${++n}`;
  }

  // Pre-fill the price currency from the company default so new paid services
  // don't silently default to USD.
  const companyCurrency = (await getCompanySettings()).profile.defaultCurrency;

  const [created] = await db
    .insert(eventTypes)
    .values({
      userId: user.id,
      scheduleId: user.defaultScheduleId ?? null,
      title,
      slug,
      length,
      currency: companyCurrency,
      // Start as a draft: hidden from the public booking pages until the first
      // save promotes it to live. Abandoned drafts are auto-cleaned by listEventTypes.
      draft: true,
      position: await nextEventTypePosition(user.id),
      locations: [] satisfies EventLocation[],
      bookingFields: DEFAULT_FIELDS,
    })
    .returning({ id: eventTypes.id });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/event-types");
  redirect(`/dashboard/event-types/${created.id}`);
}

const updateSchema = z.object({
  id: z.coerce.number(),
  title: z.string().trim().min(1).max(128),
  slug: z.string().trim().min(1).max(128).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(2000).optional().nullable(),
  length: z.coerce.number().int().min(5).max(1440),
  durations: z.array(z.coerce.number().int().min(5).max(1440)).optional(),
  hidden: z.boolean().optional(),
  beforeEventBuffer: z.coerce.number().int().min(0).max(720).optional(),
  afterEventBuffer: z.coerce.number().int().min(0).max(720).optional(),
  minimumBookingNotice: z.coerce.number().int().min(0).max(43200).optional(),
  slotInterval: z.coerce.number().int().min(5).max(1440).nullable().optional(),
  offsetStart: z.coerce.number().int().min(0).max(1439).optional(),
  seatsPerTimeSlot: z.coerce.number().int().min(1).max(1000).nullable().optional(),
  requiresConfirmation: z.boolean().optional(),
  disableGuests: z.boolean().optional(),
  recurringEvent: z
    .object({
      freq: z.enum(["weekly", "monthly"]),
      interval: z.coerce.number().int().min(1).max(12),
      count: z.coerce.number().int().min(1).max(52),
    })
    .nullable()
    .optional(),
  periodType: z.enum(["unlimited", "rolling", "rolling_window", "range"]).optional(),
  periodDays: z.coerce.number().int().min(1).max(3650).nullable().optional(),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  locations: eventLocationsSchema.optional(),
  bookingFields: bookingFieldsSchema.optional(),
  bookingLimits: bookingLimitsSchema,
  price: z.coerce.number().int().min(0).optional(),
  currency: currencySchema.optional(),
  requiresPayment: z.boolean().optional(),
  depositAmount: z.coerce.number().int().min(0).optional(),
  successRedirectUrl: z.union([httpUrlSchema, z.literal(""), z.null()]).optional(),
});

export type UpdateEventTypeInput = z.infer<typeof updateSchema>;
export type UpdateEventTypeResult = { ok: true } | { ok: false; error: string };

export async function updateEventTypeAction(input: UpdateEventTypeInput): Promise<UpdateEventTypeResult> {
  const user = await requireUser();
  const data = updateSchema.parse(input);

  // Verify ownership.
  const [owned] = await db
    .select({ id: eventTypes.id })
    .from(eventTypes)
    .where(and(eq(eventTypes.id, data.id), eq(eventTypes.userId, user.id)))
    .limit(1);
  if (!owned) throw new Error("NOT_FOUND");

  const [slugClash] = await db
    .select({ id: eventTypes.id })
    .from(eventTypes)
    .where(and(eq(eventTypes.userId, user.id), eq(eventTypes.slug, data.slug), ne(eventTypes.id, data.id)))
    .limit(1);
  if (slugClash) {
    return { ok: false, error: "A service with that slug already exists." };
  }

  await db
    .update(eventTypes)
    .set({
      title: data.title,
      slug: data.slug,
      description: data.description ?? null,
      length: data.length,
      durations: data.durations ?? [],
      hidden: data.hidden ?? false,
      beforeEventBuffer: data.beforeEventBuffer ?? 0,
      afterEventBuffer: data.afterEventBuffer ?? 0,
      minimumBookingNotice: data.minimumBookingNotice ?? 120,
      slotInterval: data.slotInterval ?? null,
      offsetStart: data.offsetStart ?? 0,
      seatsPerTimeSlot: data.seatsPerTimeSlot ?? null,
      requiresConfirmation: data.requiresConfirmation ?? false,
      disableGuests: data.disableGuests ?? false,
      recurringEvent: data.recurringEvent ?? null,
      periodType: data.periodType ?? "unlimited",
      periodDays: data.periodDays ?? null,
      categoryId: data.categoryId ?? null,
      locations: data.locations ?? [],
      bookingFields: data.bookingFields ?? DEFAULT_FIELDS,
      bookingLimits: data.bookingLimits ?? null,
      price: data.price ?? 0,
      currency: data.currency ?? "usd",
      requiresPayment: data.requiresPayment ?? false,
      depositAmount: data.depositAmount ?? 0,
      successRedirectUrl: data.successRedirectUrl ? data.successRedirectUrl : null,
      // The first save promotes a draft to a live, publicly bookable service.
      draft: false,
      updatedAt: new Date(),
    })
    .where(eq(eventTypes.id, data.id));

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/event-types");
  revalidatePath(`/dashboard/event-types/${data.id}`);
  return { ok: true };
}

export async function deleteEventTypeAction(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  await db.delete(eventTypes).where(and(eq(eventTypes.id, id), eq(eventTypes.userId, user.id)));
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/event-types");
}

export async function toggleHiddenAction(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const hidden = formData.get("hidden") === "true";
  await db
    .update(eventTypes)
    .set({ hidden: !hidden })
    .where(and(eq(eventTypes.id, id), eq(eventTypes.userId, user.id)));
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/event-types");
}

export async function duplicateEventTypeAction(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const [orig] = await db
    .select()
    .from(eventTypes)
    .where(and(eq(eventTypes.id, id), eq(eventTypes.userId, user.id)))
    .limit(1);
  if (!orig) return;

  const base = `${orig.slug}-copy`;
  let slug = base;
  let n = 1;
  while (true) {
    const clash = await db
      .select({ id: eventTypes.id })
      .from(eventTypes)
      .where(and(eq(eventTypes.userId, user.id), eq(eventTypes.slug, slug)))
      .limit(1);
    if (clash.length === 0) break;
    slug = `${base}-${++n}`;
  }

  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = orig;
  await db.insert(eventTypes).values({
    ...rest,
    slug,
    title: `${orig.title} (copy)`,
    position: await nextEventTypePosition(user.id),
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/event-types");
}

/**
 * Remove draft services that were created but never saved and have since been
 * abandoned. The 24-hour window guarantees a draft the user is still editing is
 * never deleted out from under them. Runs lazily on each services-list load so
 * no scheduled job is required.
 */
async function deleteStaleDrafts(userId: number): Promise<void> {
  await db
    .delete(eventTypes)
    .where(
      and(
        eq(eventTypes.userId, userId),
        eq(eventTypes.draft, true),
        lt(eventTypes.createdAt, sql`now() - interval '24 hours'`),
      ),
    );
}

export async function listEventTypes(userId: number) {
  await deleteStaleDrafts(userId);
  await normalizeEventTypePositions(userId);
  return db
    .select()
    .from(eventTypes)
    .where(eq(eventTypes.userId, userId))
    .orderBy(asc(eventTypes.position), asc(eventTypes.createdAt));
}

export async function reorderEventTypesAction(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const direction = formData.get("direction") as "up" | "down";

  await normalizeEventTypePositions(user.id);

  // Get all services for this user, ordered by position.
  const all = await db
    .select({ id: eventTypes.id, position: eventTypes.position })
    .from(eventTypes)
    .where(eq(eventTypes.userId, user.id))
    .orderBy(asc(eventTypes.position), asc(eventTypes.createdAt));

  const idx = all.findIndex((e) => e.id === id);
  if (idx === -1) return;

  if (direction === "up" && idx > 0) {
    // Swap positions with the previous item.
    const prev = all[idx - 1];
    const curr = all[idx];
    await db.update(eventTypes).set({ position: curr.position }).where(eq(eventTypes.id, prev.id));
    await db.update(eventTypes).set({ position: prev.position }).where(eq(eventTypes.id, curr.id));
  } else if (direction === "down" && idx < all.length - 1) {
    // Swap positions with the next item.
    const next = all[idx + 1];
    const curr = all[idx];
    await db.update(eventTypes).set({ position: curr.position }).where(eq(eventTypes.id, next.id));
    await db.update(eventTypes).set({ position: next.position }).where(eq(eventTypes.id, curr.id));
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/event-types");
}
