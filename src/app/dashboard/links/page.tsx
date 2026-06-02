import { requireUser } from "@/lib/auth";
import { listBookingLinks, userEventTypesForLinks } from "@/server/booking-links";
import { LinkManager } from "./link-manager";
import { LinkIcon } from "lucide-react";

export const metadata = { title: "Booking Links · Tidetime" };

export default async function LinksPage() {
  const user = await requireUser();
  const [links, eventTypes] = await Promise.all([
    listBookingLinks(user.id),
    userEventTypesForLinks(user.id),
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Booking Links</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Create single-use, expiring, limited, or invite-only links to share specific availability.
        </p>
      </div>

      {eventTypes.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border py-20 text-center">
          <LinkIcon className="h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Create an event type first to generate booking links.
          </p>
        </div>
      ) : (
        <LinkManager eventTypes={eventTypes} links={links} />
      )}
    </div>
  );
}
