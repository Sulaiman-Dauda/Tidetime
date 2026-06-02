import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { teams, memberships } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const MAX_SIZE = 1 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const teamId = Number(req.nextUrl.searchParams.get("teamId"));
  if (!Number.isInteger(teamId)) {
    return NextResponse.json({ error: "Invalid team ID" }, { status: 400 });
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

  if (body.byteLength > MAX_SIZE) {
    return NextResponse.json({ error: "Image must be under 1 MB" }, { status: 400 });
  }

  const contentType = req.headers.get("content-type") || "image/png";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }

  const base64 = Buffer.from(body).toString("base64");
  const dataUrl = `data:${contentType};base64,${base64}`;

  await db.update(teams).set({ logoUrl: dataUrl }).where(eq(teams.id, teamId));

  return NextResponse.json({ logoUrl: dataUrl });
}
