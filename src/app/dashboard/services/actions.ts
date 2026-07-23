"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  services,
  serviceProviders,
  memberships,
  teams,
  type BookingField,
  type EventLocation,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { bookingFieldsSchema, eventLocationsSchema } from "@/lib/schemas";

const DEFAULT_FIELDS: BookingField[] = [
  { name: "name", label: "Your name", type: "text", required: true, system: true },
  { name: "email", label: "Email address", type: "email", required: true, system: true },
  { name: "notes", label: "Notes", type: "textarea", required: false },
];

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "service";
}

async function companyForUser(userId: number) {
  const [row] = await db
    .select({ teamId: memberships.teamId, role: memberships.role, slug: teams.slug })
    .from(memberships)
    .innerJoin(teams, eq(teams.id, memberships.teamId))
    .where(and(eq(memberships.userId, userId), eq(memberships.accepted, true)))
    .orderBy(asc(memberships.id))
    .limit(1);
  if (!row) throw new Error("COMPANY_NOT_FOUND");
  return row;
}

async function companyForServiceManager(userId: number) {
  const company = await companyForUser(userId);
  if (!can(company.role, "service.catalog.manage")) throw new Error("FORBIDDEN");
  return company;
}

async function uniqueSlug(teamId: number, title: string, excludeId?: number) {
  const base = slugify(title);
  for (let suffix = 0; ; suffix++) {
    const slug = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const filters = [eq(services.teamId, teamId), eq(services.slug, slug)];
    if (excludeId) filters.push(ne(services.id, excludeId));
    const [existing] = await db.select({ id: services.id }).from(services).where(and(...filters)).limit(1);
    if (!existing) return slug;
  }
}

async function nextPosition(teamId: number) {
  const [row] = await db
    .select({ value: sql<number>`coalesce(max(${services.position}), -1)::int` })
    .from(services)
    .where(eq(services.teamId, teamId));
  return (row?.value ?? -1) + 1;
}

export async function createServiceAction(formData: FormData) {
  const user = await requireUser();
  const company = await companyForServiceManager(user.id);
  const title = String(formData.get("title") ?? "").trim() || "New service";
  const [created] = await db
    .insert(services)
    .values({
      teamId: company.teamId,
      title,
      slug: await uniqueSlug(company.teamId, title),
      length: Math.max(5, Number(formData.get("length") ?? 30)),
      draft: true,
      position: await nextPosition(company.teamId),
      locations: [{ type: "jitsi" }] satisfies EventLocation[],
      bookingFields: DEFAULT_FIELDS,
    })
    .returning({ id: services.id });
  await db.insert(serviceProviders).values({ serviceId: created.id, userId: user.id });
  revalidatePath("/dashboard/services");
  redirect(`/dashboard/services/${created.id}`);
}

const updateSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().trim().min(1).max(128),
  slug: z.string().trim().min(1).max(128).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(2000).optional().nullable(),
  length: z.number().int().min(5).max(1440),
  durations: z.array(z.number().int().min(5).max(1440)).max(6),
  hidden: z.boolean(),
  beforeEventBuffer: z.number().int().min(0).max(720),
  afterEventBuffer: z.number().int().min(0).max(720),
  minimumBookingNotice: z.number().int().min(0).max(43200),
  slotInterval: z.number().int().min(5).max(1440).nullable(),
  seatsPerSlot: z.number().int().min(1).max(100),
  maxBookingsPerDay: z.number().int().min(1).max(500).nullable(),
  requiresConfirmation: z.boolean(),
  disableGuests: z.boolean(),
  /** explicit status — saving no longer force-publishes */
  draft: z.boolean(),
  locations: eventLocationsSchema.min(1, "Add at least one location").max(3),
  bookingFields: bookingFieldsSchema,
  providerIds: z.array(z.number().int().positive()).min(1, "Assign at least one provider"),
});

export type UpdateServiceInput = z.infer<typeof updateSchema>;
export type UpdateServiceResult = { ok: true } | { ok: false; error: string };

export async function updateServiceAction(input: UpdateServiceInput): Promise<UpdateServiceResult> {
  const user = await requireUser();
  const company = await companyForServiceManager(user.id);
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid service" };
  const data = parsed.data;
  const [owned] = await db.select({ id: services.id }).from(services)
    .where(and(eq(services.id, data.id), eq(services.teamId, company.teamId))).limit(1);
  if (!owned) return { ok: false, error: "Service not found" };

  const members = await db.select({ userId: memberships.userId }).from(memberships)
    .where(and(eq(memberships.teamId, company.teamId), eq(memberships.accepted, true), inArray(memberships.userId, data.providerIds)));
  if (members.length !== new Set(data.providerIds).size) return { ok: false, error: "Choose valid company providers" };

  const [slugClash] = await db.select({ id: services.id }).from(services)
    .where(and(eq(services.teamId, company.teamId), eq(services.slug, data.slug), ne(services.id, data.id))).limit(1);
  if (slugClash) return { ok: false, error: "A service with that URL already exists" };

  await db.transaction(async (tx) => {
    await tx.update(services).set({
      title: data.title,
      slug: data.slug,
      description: data.description || null,
      length: data.length,
      durations: data.durations,
      hidden: data.hidden,
      beforeEventBuffer: data.beforeEventBuffer,
      afterEventBuffer: data.afterEventBuffer,
      minimumBookingNotice: data.minimumBookingNotice,
      slotInterval: data.slotInterval,
      seatsPerSlot: data.seatsPerSlot,
      maxBookingsPerDay: data.maxBookingsPerDay,
      locations: data.locations,
      bookingFields: data.bookingFields,
      requiresConfirmation: data.requiresConfirmation,
      disableGuests: data.disableGuests,
      draft: data.draft,
      updatedAt: new Date(),
    }).where(eq(services.id, data.id));
    await tx.delete(serviceProviders).where(eq(serviceProviders.serviceId, data.id));
    await tx.insert(serviceProviders).values([...new Set(data.providerIds)].map((userId) => ({ serviceId: data.id, userId })));
  });
  revalidatePath("/dashboard/services");
  revalidatePath(`/dashboard/services/${data.id}`);
  revalidatePublicPages(company.slug, data.slug);
  return { ok: true };
}

/** Keep the public booking pages in step with catalog changes. */
function revalidatePublicPages(teamSlug: string, serviceSlug?: string) {
  revalidatePath(`/book/${teamSlug}`);
  if (serviceSlug) revalidatePath(`/book/${teamSlug}/${serviceSlug}`);
}

export async function listServices() {
  const user = await requireUser();
  const company = await companyForUser(user.id);
  if (can(company.role, "service.catalog.view") || can(company.role, "service.catalog.manage")) {
    return db
      .select()
      .from(services)
      .where(eq(services.teamId, company.teamId))
      .orderBy(asc(services.position), asc(services.createdAt));
  }
  if (can(company.role, "service.assigned.view")) {
    return db
      .select({ service: services })
      .from(serviceProviders)
      .innerJoin(services, eq(services.id, serviceProviders.serviceId))
      .where(
        and(
          eq(serviceProviders.userId, user.id),
          eq(services.teamId, company.teamId),
        ),
      )
      .orderBy(asc(services.position), asc(services.createdAt))
      .then((rows) => rows.map((row) => row.service));
  }
  throw new Error("FORBIDDEN");
}

export async function deleteServiceAction(formData: FormData) {
  const user = await requireUser();
  const company = await companyForServiceManager(user.id);
  await db.delete(services).where(and(eq(services.id, Number(formData.get("id"))), eq(services.teamId, company.teamId)));
  revalidatePath("/dashboard/services");
  revalidatePublicPages(company.slug);
}

export async function toggleHiddenAction(formData: FormData) {
  const user = await requireUser();
  const company = await companyForServiceManager(user.id);
  const id = Number(formData.get("id"));
  const [row] = await db.select({ slug: services.slug }).from(services)
    .where(and(eq(services.id, id), eq(services.teamId, company.teamId))).limit(1);
  await db.update(services).set({ hidden: formData.get("hidden") !== "true" })
    .where(and(eq(services.id, id), eq(services.teamId, company.teamId)));
  revalidatePath("/dashboard/services");
  revalidatePublicPages(company.slug, row?.slug);
}

export async function duplicateServiceAction(formData: FormData) {
  const user = await requireUser();
  const company = await companyForServiceManager(user.id);
  const id = Number(formData.get("id"));
  const [original] = await db.select().from(services).where(and(eq(services.id, id), eq(services.teamId, company.teamId))).limit(1);
  if (!original) return;
  const hosts = await db.select({ userId: serviceProviders.userId }).from(serviceProviders).where(eq(serviceProviders.serviceId, id));
  const { id: _id, createdAt: _created, updatedAt: _updated, ...copy } = original;
  const [created] = await db.insert(services).values({
    ...copy,
    title: `${original.title} copy`,
    slug: await uniqueSlug(company.teamId, `${original.slug}-copy`),
    position: await nextPosition(company.teamId),
  }).returning({ id: services.id });
  if (hosts.length) await db.insert(serviceProviders).values(hosts.map((host) => ({ serviceId: created.id, userId: host.userId })));
  revalidatePath("/dashboard/services");
  revalidatePublicPages(company.slug);
}

export async function reorderServicesAction(formData: FormData) {
  const user = await requireUser();
  const company = await companyForServiceManager(user.id);
  const rows = await db.select({ id: services.id, position: services.position }).from(services)
    .where(eq(services.teamId, company.teamId)).orderBy(asc(services.position), asc(services.createdAt));
  const index = rows.findIndex((row) => row.id === Number(formData.get("id")));
  const target = formData.get("direction") === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= rows.length) return;
  await db.transaction(async (tx) => {
    await tx.update(services).set({ position: rows[target].position }).where(eq(services.id, rows[index].id));
    await tx.update(services).set({ position: rows[index].position }).where(eq(services.id, rows[target].id));
  });
  revalidatePath("/dashboard/services");
  revalidatePublicPages(company.slug);
}
