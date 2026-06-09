import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  routingForms,
  routingFormResponses,
  eventTypes,
  users,
  teams,
  type RoutingAction,
  type RoutingField,
  type RoutingRoute,
} from "@/db/schema";
import { shortId } from "@/lib/crypto";

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "form"
  );
}

export async function listRoutingForms(userId: number) {
  return db
    .select({
      id: routingForms.id,
      name: routingForms.name,
      slug: routingForms.slug,
      active: routingForms.active,
      fields: routingForms.fields,
      routes: routingForms.routes,
      createdAt: routingForms.createdAt,
    })
    .from(routingForms)
    .where(eq(routingForms.userId, userId))
    .orderBy(desc(routingForms.createdAt));
}

export async function getRoutingForm(id: number, userId: number) {
  const [row] = await db
    .select()
    .from(routingForms)
    .where(and(eq(routingForms.id, id), eq(routingForms.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createRoutingForm(userId: number, name: string): Promise<number> {
  const slug = `${slugify(name)}-${shortId(4)}`;
  const [row] = await db
    .insert(routingForms)
    .values({ userId, name, slug, fields: [], routes: [], fallback: null })
    .returning({ id: routingForms.id });
  return row.id;
}

export interface UpdateRoutingFormInput {
  name: string;
  description: string | null;
  fields: RoutingField[];
  routes: RoutingRoute[];
  fallback: RoutingAction | null;
  active: boolean;
}

export async function updateRoutingForm(
  id: number,
  userId: number,
  input: UpdateRoutingFormInput,
): Promise<boolean> {
  const res = await db
    .update(routingForms)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(routingForms.id, id), eq(routingForms.userId, userId)))
    .returning({ id: routingForms.id });
  return res.length > 0;
}

export async function deleteRoutingForm(id: number, userId: number): Promise<void> {
  await db.delete(routingForms).where(and(eq(routingForms.id, id), eq(routingForms.userId, userId)));
}

/** Public form (active only) by slug. */
export async function getPublicRoutingForm(slug: string) {
  const [row] = await db
    .select()
    .from(routingForms)
    .where(and(eq(routingForms.slug, slug), eq(routingForms.active, true)))
    .limit(1);
  return row ?? null;
}

/** Resolve an event type id to its public booking path (user or team service). */
export async function resolveEventTypeBookingPath(eventTypeId: number): Promise<string | null> {
  const [et] = await db
    .select({ slug: eventTypes.slug, userId: eventTypes.userId, teamId: eventTypes.teamId })
    .from(eventTypes)
    .where(and(eq(eventTypes.id, eventTypeId), eq(eventTypes.draft, false)))
    .limit(1);
  if (!et) return null;

  if (et.teamId) {
    const [team] = await db
      .select({ slug: teams.slug })
      .from(teams)
      .where(eq(teams.id, et.teamId))
      .limit(1);
    return team ? `/book/${team.slug}/${et.slug}` : null;
  }
  if (et.userId) {
    const [u] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, et.userId))
      .limit(1);
    return u ? `/${u.username}/${et.slug}` : null;
  }
  return null;
}

/** Event types the form owner can route to (for the builder's dropdowns). */
export async function listRoutableEventTypes(userId: number) {
  return db
    .select({ id: eventTypes.id, title: eventTypes.title })
    .from(eventTypes)
    .where(and(eq(eventTypes.userId, userId), eq(eventTypes.draft, false)))
    .orderBy(desc(eventTypes.createdAt));
}

export async function recordRoutingResponse(
  formId: number,
  answers: Record<string, string>,
  routedTo: RoutingAction | null,
): Promise<void> {
  await db.insert(routingFormResponses).values({ formId, answers, routedTo });
}
