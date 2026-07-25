import Link from "next/link";
import type { Route } from "next";
import { requirePermission } from "@/lib/guard";
import { listCustomers, type CustomerSort } from "@/server/customers";
import { resolveLocale } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterSelect } from "@/components/ui/filter-select";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "../_components/page-header";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

export const metadata = { title: "Customers" };

const PAGE_SIZE = 50;
const SORTS: { value: CustomerSort; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "name", label: "Name" },
  { value: "bookings", label: "Most bookings" },
];

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  const { user, teamId } = await requirePermission("customer.all.view");
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const sort: CustomerSort = (["recent", "name", "bookings"] as const).includes(
    params.sort as CustomerSort,
  )
    ? (params.sort as CustomerSort)
    : "recent";
  const page = Math.max(1, Number(params.page) || 1);

  const { rows: customers, total } = await listCustomers({
    teamId,
    search: q,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const dateFmt = new Intl.DateTimeFormat(resolveLocale(user.locale), {
    timeZone: user.timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const formatDate = (d: Date | null) => (d ? dateFmt.format(new Date(d)) : "—");

  const queryFor = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ q, sort: params.sort, ...overrides })) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return `/dashboard/customers${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Customers"
        description="Everyone who has booked with you, de-duplicated by email."
        action={
          total > 0 ? (
            <Button asChild size="sm" variant="outline">
              <a href="/api/customers/export" download>
                <Download className="h-4 w-4" /> Export CSV
              </a>
            </Button>
          ) : undefined
        }
      />

      <form className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name, email or phone…"
          className="flex h-9 w-full max-w-sm rounded-xl border border-input bg-card px-3 py-1 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
        <FilterSelect
          name="sort"
          ariaLabel="Sort customers"
          defaultValue={sort}
          className="h-9 rounded-xl text-sm"
          options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
        />
        <Button type="submit" size="sm" variant="outline" className="h-9">
          Apply
        </Button>
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
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground/70">
                    <th className="px-5 py-4 font-medium">Name</th>
                    <th className="px-5 py-4 font-medium">Contact</th>
                    <th className="px-5 py-4 font-medium">Bookings</th>
                    <th className="px-5 py-4 font-medium">Last appointment</th>
                    <th className="px-5 py-4 font-medium">Since</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="group border-b border-border/40 transition-colors last:border-0 hover:bg-secondary/30">
                      <td className="px-5 py-4 font-medium">
                        <Link
                          href={`/dashboard/customers/${c.id}` as Route}
                          className="hover:underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        <a href={`mailto:${c.email}`} className="block hover:text-foreground hover:underline">
                          {c.email}
                        </a>
                        {c.phoneNumber ? (
                          <a href={`tel:${c.phoneNumber}`} className="block text-xs hover:text-foreground hover:underline">
                            {c.phoneNumber}
                          </a>
                        ) : null}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant="secondary">{c.bookingsCount}</Badge>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{formatDate(c.lastBookingAt)}</td>
                      <td className="px-5 py-4 text-muted-foreground">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {totalPages > 1 ? (
            <div className="flex items-center justify-between text-[13px] text-muted-foreground">
              <span>
                Page {page} of {totalPages} · {total} customer{total === 1 ? "" : "s"}
              </span>
              <div className="flex gap-2">
                <Button asChild={page > 1} size="sm" variant="outline" disabled={page <= 1}>
                  {page > 1 ? (
                    <Link href={queryFor({ page: String(page - 1) }) as Route}>
                      <ChevronLeft className="h-3.5 w-3.5" /> Previous
                    </Link>
                  ) : (
                    <span><ChevronLeft className="h-3.5 w-3.5" /> Previous</span>
                  )}
                </Button>
                <Button asChild={page < totalPages} size="sm" variant="outline" disabled={page >= totalPages}>
                  {page < totalPages ? (
                    <Link href={queryFor({ page: String(page + 1) }) as Route}>
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : (
                    <span>Next <ChevronRight className="h-3.5 w-3.5" /></span>
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
