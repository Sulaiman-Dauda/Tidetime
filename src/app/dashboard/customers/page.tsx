import { requirePermission } from "@/lib/guard";
import { listCustomersForActor } from "@/server/customers";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "../_components/page-header";

export const metadata = { title: "Customers" };

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { user } = await requirePermission("customer.all.view");
  const { q } = await searchParams;
  const customers = await listCustomersForActor({ userId: user.id, search: q });

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Customers"
        description="Everyone who has booked with you, de-duplicated by email."
      />

      <form className="max-w-sm">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or email…"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>

      {customers.length === 0 ? (
        <EmptyState
          brand
          title={q ? "No matching customers" : "No customers yet"}
          description={
            q
              ? "Try a different search term."
              : "Customers appear here automatically once people book with you."
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground/70">
                  <th className="px-5 py-4 font-medium">Name</th>
                  <th className="px-5 py-4 font-medium">Email</th>
                  <th className="px-5 py-4 font-medium">Phone</th>
                  <th className="px-5 py-4 font-medium">Bookings</th>
                  <th className="px-5 py-4 font-medium">Last booking</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-border/40 last:border-0">
                    <td className="px-5 py-4 font-medium">{c.name}</td>
                    <td className="px-5 py-4 text-muted-foreground">{c.email}</td>
                    <td className="px-5 py-4 text-muted-foreground">{c.phoneNumber ?? "—"}</td>
                    <td className="px-5 py-4">
                      <Badge variant="secondary">{c.bookingsCount}</Badge>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{formatDate(c.lastBookingAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
