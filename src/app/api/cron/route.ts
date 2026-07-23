import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runDueJobs } from "@/server/jobs";
import { sha256 } from "@/lib/crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Authenticated job trigger for external schedulers (Vercel Cron, Cloud
 * Scheduler, GitHub Actions, …). Configure with a CRON_SECRET and call:
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://app/api/cron
 *
 * Shares an advisory lock with the worker, so concurrent triggers are safe.
 */
async function handle(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7) : "";

  // Constant-time comparison over fixed-length hashes.
  const a = Buffer.from(sha256(provided));
  const b = Buffer.from(sha256(secret));
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runDueJobs();
  return NextResponse.json(summary);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
