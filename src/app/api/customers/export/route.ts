import { getCurrentAuthorization } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { listCustomers } from "@/server/customers";

/** Escape one CSV cell per RFC 4180. */
function cell(value: string | number | null): string {
  const s = value === null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** GET /api/customers/export — the customer directory as a CSV download. */
export async function GET(): Promise<Response> {
  const authorization = await getCurrentAuthorization();
  if (!authorization?.role || !authorization.teamId || !can(authorization.role, "customer.all.view")) {
    return new Response("Forbidden", { status: 403 });
  }

  const { rows } = await listCustomers({
    teamId: authorization.teamId,
    pageSize: 10_000,
  });

  const lines = [
    "name,email,phone,timezone,bookings,last_appointment,customer_since",
    ...rows.map((c) =>
      [
        cell(c.name),
        cell(c.email),
        cell(c.phoneNumber),
        cell(c.timeZone),
        cell(c.bookingsCount),
        cell(c.lastBookingAt ? c.lastBookingAt.toISOString() : null),
        cell(c.createdAt.toISOString()),
      ].join(","),
    ),
  ];

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="customers.csv"',
      "Cache-Control": "no-store",
    },
  });
}
