import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Video, Clock } from "lucide-react";
import { db } from "@/db";
import { bookings, users } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { CompanyBrandHeader } from "../../(public)/_components/company-brand-header";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join meeting" };

/** Grace period after the scheduled end during which the room is still joinable. */
const GRACE_MS = 30 * 60 * 1000;

export default async function InstantJoinPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const [row] = await db
    .select({
      title: bookings.title,
      meetingUrl: bookings.meetingUrl,
      endTime: bookings.endTime,
      status: bookings.status,
      hostName: users.name,
      hostUsername: users.username,
    })
    .from(bookings)
    .leftJoin(users, eq(bookings.userId, users.id))
    .where(eq(bookings.uid, uid))
    .limit(1);

  if (!row || !row.meetingUrl) notFound();

  const expired = row.status === "cancelled" || Date.now() > row.endTime.getTime() + GRACE_MS;
  const host = row.hostName ?? row.hostUsername ?? "your host";

  return (
    <main className="min-h-screen bg-grid">
      <CompanyBrandHeader />
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          {expired ? <Clock className="h-6 w-6" /> : <Video className="h-6 w-6" />}
        </div>
        {expired ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight">This meeting has ended</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              The instant meeting with {host} is no longer available.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight">{row.title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              You&apos;re invited to a live video meeting with {host}.
            </p>
            <Button asChild className="mt-6">
              <a href={row.meetingUrl} target="_blank" rel="noreferrer">
                <Video className="h-4 w-4" /> Join meeting
              </a>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
