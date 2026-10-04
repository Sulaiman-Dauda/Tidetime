import Link from "next/link";
import type { Route } from "next";
import { requirePermission } from "@/lib/guard";
import { listCustomers, type CustomerSort } from "@/server/customers";
import { initials, resolveLocale } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FilterSelect } from "@/components/ui/filter-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "../_components/page-header";
import { ChevronLeft, ChevronRight, Download, Search, Users } from "lucide-react";

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
  const formatDate = (d: Date | null) => (d ? dateFmt.format(new Date(d)) : "None");

  const queryFor = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ q, sort: params.sort, ...overrides })) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return `/dashboard/customers${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Everyone who has booked with you, de-duplicated by email."
        action={
          total > 0 ? (
            <Button asChild size="sm" variant="outline">
              <a href="/api/customers/export" download>
                <Download /> Export CSV
              </a>
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search name, email or phone…"
                aria-label="Search customers"
                className="h-8 pl-8 text-meta"
              />
            </div>
            <FilterSelect
              name="sort"
              ariaLabel="Sort customers"
              defaultValue={sort}
              options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
            />
            <Button type="submit" size="sm" variant="outline">
              Apply
            </Button>
          </form>
          {total > 0 ? (
            <p className="text-meta text-muted-foreground tabular-nums">
              {total} customer{total === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>

        {customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={q ? "No matching customers" : "No customers yet"}
            description={
              q
                ? "Try a different search term."
                : "Customers appear here automatically once people book with you."
            }
            action={
              q ? (
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/customers">Clear search</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="hidden sm:table-cell">Last booking</TableHead>
                  <TableHead className="hidden lg:table-cell">Customer since</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback>{initials(c.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 max-w-44 sm:max-w-xs">
                          <Link
                            href={`/dashboard/customers/${c.id}` as Route}
                            className="block truncate rounded-sm font-medium text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
                          >
                            {c.name}
                          </Link>
                          <a
                            href={`mailto:${c.email}`}
                            className="block truncate text-meta text-muted-foreground hover:text-foreground hover:underline"
                          >
                            {c.email}
                          </a>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground tabular-nums md:table-cell">
                      {c.phoneNumber ? (
                        <a href={`tel:${c.phoneNumber}`} className="hover:text-foreground hover:underline">
                          {c.phoneNumber}
                        </a>
                      ) : (
                        "None"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.bookingsCount}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">
                      {formatDate(c.lastBookingAt)}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground tabular-nums lg:table-cell">
                      {formatDate(c.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 ? (
              <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-meta text-muted-foreground">
                <span className="tabular-nums">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button asChild={page > 1} size="sm" variant="outline" disabled={page <= 1}>
                    {page > 1 ? (
                      <Link href={queryFor({ page: String(page - 1) }) as Route}>
                        <ChevronLeft /> Previous
                      </Link>
                    ) : (
                      <span>
                        <ChevronLeft /> Previous
                      </span>
                    )}
                  </Button>
                  <Button asChild={page < totalPages} size="sm" variant="outline" disabled={page >= totalPages}>
                    {page < totalPages ? (
                      <Link href={queryFor({ page: String(page + 1) }) as Route}>
                        Next <ChevronRight />
                      </Link>
                    ) : (
                      <span>
                        Next <ChevronRight />
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        )}
      </div>
    </div>
  );
}
