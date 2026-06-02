import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { webhooks, webhookTrigger } from "@/db/schema";
import { authenticateApiKey, unauthorized, jsonError, parsePage } from "@/server/api-auth";
import { randomToken } from "@/lib/crypto";
import { httpUrlSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const TRIGGERS = webhookTrigger.enumValues;

/** GET /api/v1/webhooks — list the user's webhooks. */
export async function GET(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();
  const { limit, offset } = parsePage(req);
  const rows = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.userId, user.id))
    .limit(limit)
    .offset(offset);
  return NextResponse.json({ data: rows, page: { limit, offset } });
}

const createSchema = z.object({
  subscriberUrl: httpUrlSchema,
  triggers: z.array(z.enum(TRIGGERS as [string, ...string[]])).min(1),
  secret: z.string().min(8).optional(),
  eventTypeId: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});

/** POST /api/v1/webhooks — register a webhook. */
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

  const [row] = await db
    .insert(webhooks)
    .values({
      userId: user.id,
      subscriberUrl: parsed.data.subscriberUrl,
      triggers: parsed.data.triggers as (typeof TRIGGERS)[number][],
      secret: parsed.data.secret ?? randomToken(24),
      eventTypeId: parsed.data.eventTypeId ?? null,
      active: parsed.data.active ?? true,
    })
    .returning();
  return NextResponse.json({ data: row }, { status: 201 });
}
