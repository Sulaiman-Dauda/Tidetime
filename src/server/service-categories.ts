import "server-only";
import { db } from "@/db";
import { serviceCategories, eventTypes } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";

export interface ServiceCategoryRow {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  position: number;
}

/** List instance-wide service categories ordered for display. */
export async function listServiceCategories(): Promise<ServiceCategoryRow[]> {
  return db
    .select({
      id: serviceCategories.id,
      name: serviceCategories.name,
      description: serviceCategories.description,
      color: serviceCategories.color,
      position: serviceCategories.position,
    })
    .from(serviceCategories)
    .orderBy(asc(serviceCategories.position), asc(serviceCategories.id));
}

/** List categories together with how many services each contains. */
export async function listServiceCategoriesWithCounts(): Promise<
  (ServiceCategoryRow & { eventTypeCount: number })[]
> {
  const rows = await db
    .select({
      id: serviceCategories.id,
      name: serviceCategories.name,
      description: serviceCategories.description,
      color: serviceCategories.color,
      position: serviceCategories.position,
      eventTypeCount: sql<number>`count(${eventTypes.id})::int`,
    })
    .from(serviceCategories)
    .leftJoin(eventTypes, eq(eventTypes.categoryId, serviceCategories.id))
    .groupBy(serviceCategories.id)
    .orderBy(asc(serviceCategories.position), asc(serviceCategories.id));
  return rows;
}

export async function createServiceCategory(input: {
  name: string;
  description?: string | null;
  color?: string | null;
}): Promise<number> {
  const [{ position }] = await db
    .select({ position: sql<number>`coalesce(max(${serviceCategories.position}), -1)::int` })
    .from(serviceCategories);
  const [row] = await db
    .insert(serviceCategories)
    .values({
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? null,
      position: (position ?? -1) + 1,
    })
    .returning({ id: serviceCategories.id });
  return row.id;
}

export async function updateServiceCategory(
  id: number,
  input: { name: string; description?: string | null; color?: string | null },
): Promise<void> {
  await db
    .update(serviceCategories)
    .set({
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? null,
    })
    .where(eq(serviceCategories.id, id));
}

export async function deleteServiceCategory(id: number): Promise<void> {
  // event_types.categoryId is ON DELETE SET NULL, so events are simply uncategorised.
  await db.delete(serviceCategories).where(eq(serviceCategories.id, id));
}
