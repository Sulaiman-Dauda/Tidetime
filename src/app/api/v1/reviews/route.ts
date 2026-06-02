import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, unauthorized } from "@/server/api-auth";
import { listReviews, reviewStats } from "@/server/reviews";

export const dynamic = "force-dynamic";

/** GET /api/v1/reviews — list the authenticated user's reviews + summary stats. */
export async function GET(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();

  const [data, stats] = await Promise.all([listReviews(user.id), reviewStats(user.id)]);
  return NextResponse.json({ data, stats });
}
