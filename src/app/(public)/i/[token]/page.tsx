import { redirect } from "next/navigation";
import { db } from "@/db";
import { eventTypes, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveBookingLink } from "@/server/booking-links";
import { Card } from "@/components/ui/card";
import { LinkIcon } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking link · Tidetime" };

/**
 * Public entry point for a temporary booking link. Validates the token and
 * forwards to the event-type booking page (carrying the token so the booking
 * action can re-validate and consume it).
 */
export default async function InviteLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveBookingLink(token);

  if (!resolved.ok || !resolved.link) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
        <Card className="w-full p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <LinkIcon className="h-6 w-6 text-muted-foreground" />
          </span>
          <h1 className="mt-4 text-lg font-semibold">Link unavailable</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {resolved.error ?? "This booking link can no longer be used."}
          </p>
        </Card>
      </div>
    );
  }

  const [et] = await db
    .select({ slug: eventTypes.slug, username: users.username })
    .from(eventTypes)
    .innerJoin(users, eq(eventTypes.userId, users.id))
    .where(eq(eventTypes.id, resolved.link.eventTypeId))
    .limit(1);

  if (!et) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
        <Card className="w-full p-8 text-center">
          <h1 className="text-lg font-semibold">Event not found</h1>
        </Card>
      </div>
    );
  }

  redirect(`/${et.username}/${et.slug}?link=${encodeURIComponent(token)}`);
}
