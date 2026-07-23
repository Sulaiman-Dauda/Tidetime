import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lightweight readiness probe for orchestration and uptime checks.
 * Returns 200 when the app can talk to PostgreSQL, 503 otherwise.
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    await db.execute(sql`select 1`);
    return NextResponse.json(
      {
        status: "ok",
        database: "up",
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        database: "down",
        timestamp: new Date().toISOString(),
        error: "Database unavailable",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
