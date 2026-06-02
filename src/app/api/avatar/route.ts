import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// 1 MB max
const MAX_SIZE = 1 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: ArrayBuffer;
  try {
    body = await req.arrayBuffer();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  if (body.byteLength === 0) {
    // Remove avatar
    await db.update(users).set({ avatarUrl: null }).where(eq(users.id, user.id));
    return NextResponse.json({ avatarUrl: null });
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

  await db.update(users).set({ avatarUrl: dataUrl }).where(eq(users.id, user.id));

  return NextResponse.json({ avatarUrl: dataUrl });
}
