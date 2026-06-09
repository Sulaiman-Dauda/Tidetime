import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { teams, memberships } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { can } from "@/lib/rbac";
import { buildImageDataUrl, MAX_IMAGE_BYTES } from "@/lib/image-upload";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const teamId = Number(req.nextUrl.searchParams.get("teamId"));
  if (!Number.isInteger(teamId)) {
    return NextResponse.json({ error: "Invalid team ID" }, { status: 400 });
  }

  const limit = checkRateLimit(`logo:${user.id}`, { limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many uploads. Please slow down." }, { status: 429 });
  }

  // Check membership and permission
  const [member] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.teamId, teamId), eq(memberships.userId, user.id)))
    .limit(1);

  if (!member) return NextResponse.json({ error: "Not a team member" }, { status: 403 });
  if (!can(member.role, "team.manage")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  let body: ArrayBuffer;
  try {
    body = await req.arrayBuffer();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  if (body.byteLength === 0) {
    await db.update(teams).set({ logoUrl: null }).where(eq(teams.id, teamId));
    return NextResponse.json({ logoUrl: null });
  }

  if (body.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be under 1 MB" }, { status: 400 });
  }

  // Validate by content (magic bytes), not the client-supplied Content-Type.
  const result = buildImageDataUrl(new Uint8Array(body));
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await db.update(teams).set({ logoUrl: result.dataUrl }).where(eq(teams.id, teamId));

  return NextResponse.json({ logoUrl: result.dataUrl });
}
