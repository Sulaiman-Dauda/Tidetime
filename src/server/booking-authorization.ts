import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, services, type MembershipRole } from "@/db/schema";
import { can } from "@/lib/rbac";

/**
 * Resolve a booking only when the actor owns it or has company-wide access to
 * the service that created it. Keeping this check in SQL prevents direct
 * server-action calls from bypassing dashboard visibility rules.
 */
export async function bookingForActor(input: {
  uid: string;
  userId: number;
  teamId: number;
  role: MembershipRole;
  operation: "view" | "manage";
}) {
  const hasCompanyAccess =
    input.operation === "view"
      ? can(input.role, "booking.all.view")
      : can(input.role, "booking.all.manage");

  const [row] = await db
    .select({ booking: bookings })
    .from(bookings)
    .leftJoin(services, eq(services.id, bookings.serviceId))
    .where(
      and(
        eq(bookings.uid, input.uid),
        hasCompanyAccess
          ? eq(services.teamId, input.teamId)
          : eq(bookings.userId, input.userId),
      ),
    )
    .limit(1);

  return row?.booking ?? null;
}
