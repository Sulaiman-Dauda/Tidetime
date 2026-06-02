import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey, unauthorized, jsonError } from "@/server/api-auth";
import { createBookingLink, userOwnsEventType } from "@/server/booking-links";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const schema = z.object({
  eventTypeId: z.number().int().positive(),
  kind: z.enum(["one_time", "expiring", "limited", "invite"]),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  inviteEmail: z.string().email().optional(),
});

/** POST /api/v1/booking-links — create a temporary booking link. */
export async function POST(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");

  if (!(await userOwnsEventType(user.id, parsed.data.eventTypeId))) {
    return jsonError("Event type not found", 404);
  }

  const { token } = await createBookingLink({
    eventTypeId: parsed.data.eventTypeId,
    createdByUserId: user.id,
    kind: parsed.data.kind,
    maxUses: parsed.data.maxUses,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    inviteEmail: parsed.data.inviteEmail,
  });

  return NextResponse.json(
    { data: { token, url: `${env.appUrl}/i/${token}` } },
    { status: 201 },
  );
}
