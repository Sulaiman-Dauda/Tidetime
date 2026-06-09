import { NextResponse } from "next/server";
import { createAltchaChallenge } from "@/lib/altcha";

export const dynamic = "force-dynamic";

/** GET /api/altcha/challenge — issue a fresh proof-of-work challenge. */
export async function GET() {
  return NextResponse.json(createAltchaChallenge(), {
    headers: { "Cache-Control": "no-store" },
  });
}
