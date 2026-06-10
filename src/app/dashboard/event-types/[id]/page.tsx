import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { eventTypes } from "@/db/schema";
import { listServiceCategories } from "@/server/service-categories";
import { getAvailableVideoLocations } from "@/app-store/registry";
import { getAppUrl } from "@/server/app-url";
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

  const categories = await listServiceCategories();
  const availableVideo = await getAvailableVideoLocations(user.id);
  const appUrl = await getAppUrl();

  return (
    <EventTypeEditor
      eventType={et}
      username={user.username}
      appUrl={appUrl}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      availableVideo={availableVideo}
    />
  );
}
