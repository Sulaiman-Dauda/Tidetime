import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { eventTypes } from "@/db/schema";
import { listResources, getEventTypeResources } from "@/server/resources";
import { listServiceCategories } from "@/server/service-categories";
import { env } from "@/lib/env";
import { EventTypeEditor } from "./editor";

export default async function EventTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getCurrentUser())!;
  const eventTypeId = Number(id);
  if (!Number.isFinite(eventTypeId)) notFound();

  const [et] = await db
    .select()
    .from(eventTypes)
    .where(and(eq(eventTypes.id, eventTypeId), eq(eventTypes.userId, user.id)))
    .limit(1);
  if (!et) notFound();

  const [resources, selected] = await Promise.all([
    listResources({ userId: user.id }),
    getEventTypeResources(eventTypeId),
  ]);

  const categories = await listServiceCategories();

  return (
    <EventTypeEditor
      eventType={et}
      username={user.username}
      appUrl={env.appUrl}
      resources={resources
        .filter((r) => r.active)
        .map((r) => ({ id: r.id, name: r.name, type: r.type, capacity: r.capacity }))}
      selectedResourceIds={selected.map((s) => s.resourceId)}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
