import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { eventTypes } from "@/db/schema";
import { authenticateApiKey, unauthorized, jsonError } from "@/server/api-auth";

export const dynamic = "force-dynamic";

async function ownedEventType(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(eventTypes)
    .where(and(eq(eventTypes.id, id), eq(eventTypes.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** GET /api/v1/event-types/:id */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();
  const { id } = await params;
  const row = await ownedEventType(user.id, Number(id));
  if (!row) return jsonError("Not found", 404);
  return NextResponse.json({ data: row });
}

const updateSchema = z.object({
  title: z.string().min(1).max(128).optional(),
  description: z.string().nullable().optional(),
  length: z.number().int().positive().max(1440).optional(),
  hidden: z.boolean().optional(),
  requiresConfirmation: z.boolean().optional(),
  minimumBookingNotice: z.number().int().min(0).optional(),
  beforeEventBuffer: z.number().int().min(0).optional(),
  afterEventBuffer: z.number().int().min(0).optional(),
  price: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
});

/** PATCH /api/v1/event-types/:id */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();
  const { id } = await params;
  const existing = await ownedEventType(user.id, Number(id));
  if (!existing) return jsonError("Not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");

  const [row] = await db
    .update(eventTypes)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(eventTypes.id, Number(id)))
    .returning();
  return NextResponse.json({ data: row });
}

/** DELETE /api/v1/event-types/:id */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();
  const { id } = await params;
  const existing = await ownedEventType(user.id, Number(id));
  if (!existing) return jsonError("Not found", 404);

  await db.delete(eventTypes).where(eq(eventTypes.id, Number(id)));
  return NextResponse.json({ data: { id: Number(id), deleted: true } });
}
