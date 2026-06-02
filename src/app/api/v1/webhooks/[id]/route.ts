import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { webhooks, webhookTrigger } from "@/db/schema";
import { authenticateApiKey, unauthorized, jsonError } from "@/server/api-auth";
import { httpUrlSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const TRIGGERS = webhookTrigger.enumValues;

async function ownedWebhook(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** GET /api/v1/webhooks/:id */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();
  const { id } = await params;
  const row = await ownedWebhook(user.id, Number(id));
  if (!row) return jsonError("Not found", 404);
  return NextResponse.json({ data: row });
}

const updateSchema = z.object({
  subscriberUrl: httpUrlSchema.optional(),
  triggers: z.array(z.enum(TRIGGERS as [string, ...string[]])).min(1).optional(),
  secret: z.string().min(8).optional(),
  active: z.boolean().optional(),
});

/** PATCH /api/v1/webhooks/:id */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();
  const { id } = await params;
  if (!(await ownedWebhook(user.id, Number(id)))) return jsonError("Not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");

  const [row] = await db
    .update(webhooks)
    .set({
      ...parsed.data,
      triggers: parsed.data.triggers as (typeof TRIGGERS)[number][] | undefined,
    })
    .where(eq(webhooks.id, Number(id)))
    .returning();
  return NextResponse.json({ data: row });
}

/** DELETE /api/v1/webhooks/:id */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();
  const { id } = await params;
  if (!(await ownedWebhook(user.id, Number(id)))) return jsonError("Not found", 404);

  await db.delete(webhooks).where(eq(webhooks.id, Number(id)));
  return NextResponse.json({ data: { id: Number(id), deleted: true } });
}
