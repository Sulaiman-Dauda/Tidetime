import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, unauthorized } from "@/server/api-auth";
import { updateResource, deleteResource } from "@/server/resources";

export const dynamic = "force-dynamic";

/** PATCH /api/v1/resources/:id — update a resource. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.description === "string") patch.description = body.description;
  if (typeof body.color === "string") patch.color = body.color;
  if (typeof body.active === "boolean") patch.active = body.active;
  if (body.capacity !== undefined) {
    const c = Number(body.capacity);
    if (Number.isFinite(c) && c >= 1) patch.capacity = Math.round(c);
  }

  const updated = await updateResource(id, user.id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}

/** DELETE /api/v1/resources/:id — remove a resource. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const ok = await deleteResource(id, user.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: { id } });
}
