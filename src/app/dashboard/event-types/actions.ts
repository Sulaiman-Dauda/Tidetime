"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { eventTypes, type BookingField, type EventLocation } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { setEventTypeResources } from "@/server/resources";
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

  const [created] = await db
    .insert(eventTypes)
    .values({
      userId: user.id,
      scheduleId: user.defaultScheduleId ?? null,
      title,
      slug,
      length,
      locations: [{ type: "google_meet" }] satisfies EventLocation[],
      bookingFields: DEFAULT_FIELDS,
    })
    .returning({ id: eventTypes.id });

  revalidatePath("/dashboard");
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
  locations: eventLocationsSchema.optional(),
  bookingFields: bookingFieldsSchema.optional(),
  bookingLimits: bookingLimitsSchema,
  price: z.coerce.number().int().min(0).optional(),
  currency: currencySchema.optional(),
  successRedirectUrl: z.union([httpUrlSchema, z.literal(""), z.null()]).optional(),
  resourceIds: z.array(z.coerce.number().int().positive()).optional(),
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
    return { ok: false, error: "An event type with that slug already exists." };
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
      locations: data.locations ?? [],
      bookingFields: data.bookingFields ?? DEFAULT_FIELDS,
      bookingLimits: data.bookingLimits ?? null,
      price: data.price ?? 0,
      currency: data.currency ?? "usd",
      successRedirectUrl: data.successRedirectUrl ? data.successRedirectUrl : null,
      updatedAt: new Date(),
    })
    .where(eq(eventTypes.id, data.id));

  if (data.resourceIds) {
    await setEventTypeResources(data.id, data.resourceIds);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/event-types/${data.id}`);
  return { ok: true };
}

export async function deleteEventTypeAction(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  await db.delete(eventTypes).where(and(eq(eventTypes.id, id), eq(eventTypes.userId, user.id)));
  revalidatePath("/dashboard");
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
  await db.insert(eventTypes).values({ ...rest, slug, title: `${orig.title} (copy)` });
  revalidatePath("/dashboard");
}

export async function listEventTypes(userId: number) {
  return db
    .select()
    .from(eventTypes)
    .where(eq(eventTypes.userId, userId))
    .orderBy(desc(eventTypes.position), desc(eventTypes.createdAt));
}
