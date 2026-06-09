import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listBookingLinks, userEventTypesForLinks } from "@/server/booking-links";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "../_components/page-header";
import { LinkManager } from "./link-manager";
import { LinkIcon } from "lucide-react";

export const metadata = { title: "Booking Links" };

export default async function LinksPage() {
  const user = await requireUser();
  const [links, eventTypes] = await Promise.all([
    listBookingLinks(user.id),
    userEventTypesForLinks(user.id),
  ]);

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Booking Links"
        description="Create single-use, expiring, limited, or invite-only links to share specific availability."
      />

      {eventTypes.length === 0 ? (
        <EmptyState
          icon={LinkIcon}
          title="No services to link yet"
          description="Create a service first, then generate booking links to share its availability."
          action={
            <Button asChild size="sm">
              <Link href="/dashboard/event-types">Create a service</Link>
            </Button>
          }
        />
      ) : (
        <LinkManager eventTypes={eventTypes} links={links} />
      )}
    </div>
  );
}
