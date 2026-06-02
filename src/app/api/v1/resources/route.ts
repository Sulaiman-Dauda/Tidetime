import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, resourceType as resourceTypeEnum } from "@/db/schema";
import { authenticateApiKey, unauthorized } from "@/server/api-auth";
import { listResources, createResource } from "@/server/resources";

export const dynamic = "force-dynamic";

async function teamIdsFor(userId: number): Promise<number[]> {
  const rows = await db
    .select({ teamId: memberships.teamId })
    .from(memberships)
    .where(eq(memberships.userId, userId));
  return rows.map((r) => r.teamId);
}

/** GET /api/v1/resources — list the authenticated user's bookable resources. */
export async function GET(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();
  const data = await listResources({ userId: user.id, teamIds: await teamIdsFor(user.id) });
  return NextResponse.json({ data });
}

/** POST /api/v1/resources — create a resource. */
export async function POST(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const type = typeof body.type === "string" ? body.type : "room";
  if (!resourceTypeEnum.enumValues.includes(type as never)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }
  const capacity = Number(body.capacity);

  const resource = await createResource({
    userId: user.id,
    name: body.name.trim(),
    type: type as (typeof resourceTypeEnum.enumValues)[number],
    description: typeof body.description === "string" ? body.description : null,
    capacity: Number.isFinite(capacity) && capacity >= 1 ? Math.round(capacity) : 1,
    color: typeof body.color === "string" ? body.color : null,
  });

  return NextResponse.json({ data: resource }, { status: 201 });
}
