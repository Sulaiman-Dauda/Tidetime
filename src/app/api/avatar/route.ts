import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildImageDataUrl, MAX_IMAGE_BYTES } from "@/lib/image-upload";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = checkRateLimit(`avatar:${user.id}`, { limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many uploads. Please slow down." }, { status: 429 });
  }

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

  if (body.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be under 1 MB" }, { status: 400 });
  }

  // Validate by content (magic bytes), not the client-supplied Content-Type.
  const result = buildImageDataUrl(new Uint8Array(body));
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await db.update(users).set({ avatarUrl: result.dataUrl }).where(eq(users.id, user.id));

  return NextResponse.json({ avatarUrl: result.dataUrl });
}
