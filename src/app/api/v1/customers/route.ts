import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { authenticateApiKey, unauthorized, parsePage } from "@/server/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/v1/customers — list/search the authenticated user's customers. */
export async function GET(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();

  const { limit, offset } = parsePage(req);
  const q = req.nextUrl.searchParams.get("q")?.trim();

  const where = q
    ? and(
        eq(customers.userId, user.id),
        or(ilike(customers.name, `%${q}%`), ilike(customers.email, `%${q}%`)),
      )
    : eq(customers.userId, user.id);

  const rows = await db
    .select()
    .from(customers)
    .where(where)
    .orderBy(desc(customers.lastBookingAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ data: rows, page: { limit, offset } });
}
