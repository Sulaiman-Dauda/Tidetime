import { requireUser } from "@/lib/auth";
import { listCustomersForActor } from "@/server/customers";
import { getCustomerFieldDefs } from "@/server/customer-fields";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "../_components/page-header";
import { Users } from "lucide-react";
import { CustomerEditor, CustomerFieldsManager } from "./customers-client";

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
  const user = await requireUser();
  const { q } = await searchParams;
  const [customers, fieldDefs] = await Promise.all([
    listCustomersForActor({ userId: user.id, search: q }),
    getCustomerFieldDefs(),
  ]);

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Customers"
        description="Everyone who has booked with you, de-duplicated by email."
        action={user.isAdmin ? <CustomerFieldsManager fieldDefs={fieldDefs} /> : undefined}
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
          icon={Users}
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
                  {fieldDefs.map((f) => (
                    <th key={f.id} className="px-5 py-4 font-medium">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-5 py-4 font-medium">Bookings</th>
                  <th className="px-5 py-4 font-medium">Last booking</th>
                  <th className="px-5 py-4 font-medium sr-only">Edit</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-border/40 last:border-0">
                    <td className="px-5 py-4 font-medium">{c.name}</td>
                    <td className="px-5 py-4 text-muted-foreground">{c.email}</td>
                    <td className="px-5 py-4 text-muted-foreground">{c.phoneNumber ?? "—"}</td>
                    {fieldDefs.map((f) => (
                      <td key={f.id} className="px-5 py-4 text-muted-foreground">
                        {c.customFields?.[f.id] ?? "—"}
                      </td>
                    ))}
                    <td className="px-5 py-4">
                      <Badge variant="secondary">{c.bookingsCount}</Badge>
                      {c.noShowCount > 0 && (
                        <span className="ml-2 text-xs text-destructive">{c.noShowCount} no-show</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{formatDate(c.lastBookingAt)}</td>
                    <td className="px-5 py-2 text-right">
                      <CustomerEditor
                        customer={{ id: c.id, name: c.name, notes: c.notes, customFields: c.customFields }}
                        fieldDefs={fieldDefs}
                      />
                    </td>
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
