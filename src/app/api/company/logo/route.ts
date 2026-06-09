import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { buildImageDataUrl, MAX_IMAGE_BYTES } from "@/lib/image-upload";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/company/logo — validate an uploaded company logo and return a safe
 * `data:` URL. Admin-only. Persistence happens when the Brand form is saved
 * (the returned URL fills the logo field), keeping a single source of truth.
 */
export async function POST(req: NextRequest) {
  const user = await requireAdmin();

  const limit = checkRateLimit(`company-logo:${user.id}`, { limit: 20, windowMs: 60_000 });
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
    return NextResponse.json({ error: "Empty upload" }, { status: 400 });
  }
  if (body.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be under 1 MB" }, { status: 400 });
  }

  // Validate by content (magic bytes), not the client-supplied Content-Type.
  const result = buildImageDataUrl(new Uint8Array(body));
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ url: result.dataUrl });
}
