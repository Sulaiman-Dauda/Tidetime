import { requireUser } from "@/lib/auth";
import { listResources, eventTypeUsageCounts } from "@/server/resources";
import { ResourceManager } from "./resource-manager";

export const metadata = { title: "Resources" };

export default async function ResourcesPage() {
  const user = await requireUser();
  const resources = await listResources({ userId: user.id });
  const usage = await eventTypeUsageCounts(resources.map((r) => r.id));

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Resources</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Rooms, equipment, and other shared assets. Attach a resource to an event type and
          Tidetime prevents double-booking beyond its capacity — so attendees book a person, a
          place, and the equipment in one step.
        </p>
      </div>
      <ResourceManager resources={resources} usage={usage} />
    </div>
  );
}
