import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { eventTypes } from "@/db/schema";
import { authenticateApiKey, unauthorized, jsonError, parsePage } from "@/server/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/v1/event-types — list the authenticated user's event types. */
export async function GET(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();

  const { limit, offset } = parsePage(req);
  const rows = await db
    .select()
    .from(eventTypes)
    .where(eq(eventTypes.userId, user.id))
    .orderBy(eventTypes.position)
    .limit(limit)
    .offset(offset);
  return NextResponse.json({ data: rows, page: { limit, offset } });
}

const createSchema = z.object({
  title: z.string().min(1).max(128),
  slug: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers and dashes"),
  description: z.string().optional(),
  length: z.number().int().positive().max(1440).optional(),
  hidden: z.boolean().optional(),
  requiresConfirmation: z.boolean().optional(),
  minimumBookingNotice: z.number().int().min(0).optional(),
  price: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
});

/** POST /api/v1/event-types — create a personal event type. */
export async function POST(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");

  // Enforce slug uniqueness per user.
  const [dupe] = await db
    .select({ id: eventTypes.id })
    .from(eventTypes)
    .where(and(eq(eventTypes.userId, user.id), eq(eventTypes.slug, parsed.data.slug)))
    .limit(1);
  if (dupe) return jsonError("An event type with that slug already exists", 409);

  const [row] = await db
    .insert(eventTypes)
    .values({ ...parsed.data, userId: user.id })
    .returning();
  return NextResponse.json({ data: row }, { status: 201 });
}

