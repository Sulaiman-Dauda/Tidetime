import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarX2 } from "lucide-react";
import { requirePermission } from "@/lib/guard";
import { getCustomerWithBookings } from "@/server/customers";
import { formatRange, resolveLocale } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "../../_components/page-header";
import { DeleteCustomerButton } from "./delete-customer-button";

export const metadata = { title: "Customer" };

const STATUS_BADGES: Record<
  string,
  { label: string; variant: "success" | "pending" | "secondary" | "destructive" }
> = {
  accepted: { label: "Confirmed", variant: "success" },
  pending: { label: "Pending", variant: "pending" },
  cancelled: { label: "Cancelled", variant: "secondary" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, teamId } = await requirePermission("customer.all.view");
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isInteger(customerId)) notFound();

  const data = await getCustomerWithBookings(teamId, customerId);
  if (!data) notFound();
  const { customer, history } = data;
  const hour12 = user.timeFormat === 12;

  const dateFmt = new Intl.DateTimeFormat(resolveLocale(user.locale), {
    timeZone: user.timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const details: { label: string; value: React.ReactNode }[] = [
    {
      label: "Email",
      value: (
        <a href={`mailto:${customer.email}`} className="break-all hover:underline">
          {customer.email}
        </a>
      ),
    },
    {
      label: "Phone",
      value: customer.phoneNumber ? (
        <a href={`tel:${customer.phoneNumber}`} className="tabular-nums hover:underline">
          {customer.phoneNumber}
        </a>
      ) : (
        <span className="text-muted-foreground">Not provided</span>
      ),
    },
    {
      label: "Time zone",
      value: customer.timeZone ? (
        customer.timeZone.replace(/_/g, " ")
      ) : (
        <span className="text-muted-foreground">Not known</span>
      ),
    },
    {
      label: "Active bookings",
      value: <span className="tabular-nums">{customer.bookingsCount}</span>,
    },
    {
      label: "Last booking",
      value: customer.lastBookingAt ? (
        <span className="tabular-nums">{dateFmt.format(new Date(customer.lastBookingAt))}</span>
      ) : (
        <span className="text-muted-foreground">None</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/dashboard/customers", label: "Customers" }}
        title={customer.name}
        description={`Customer since ${dateFmt.format(new Date(customer.createdAt))}`}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card className="overflow-hidden">
          <CardHeader className="border-b py-4">
            <CardTitle>Booking history</CardTitle>
          </CardHeader>
          {history.length === 0 ? (
            <EmptyState
              bare
              icon={CalendarX2}
              title="No bookings found"
              description="Bookings this customer makes with you will appear here."
            />
          ) : (
            <ul className="divide-y">
              {history.map((b) => {
                const badge = STATUS_BADGES[b.status] ?? { label: b.status, variant: "secondary" as const };
                const inactive = b.status === "cancelled" || b.status === "rejected";
                return (
                  <li key={b.uid}>
                    <Link
                      href={`/dashboard/bookings/${b.uid}`}
                      className="flex items-center justify-between gap-4 px-5 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "truncate text-sm font-medium",
                            inactive && "text-muted-foreground line-through",
                          )}
                        >
                          {b.serviceTitle ?? b.title}
                        </p>
                        <p className="mt-0.5 break-words text-meta text-muted-foreground tabular-nums sm:truncate">
                          {formatRange(b.startTime, b.endTime, user.timeZone, hour12, user.locale)}
                          {b.location ? ` · ${b.location}` : ""}
                        </p>
                      </div>
                      <Badge variant={badge.variant} dot>
                        {badge.label}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader className="border-b py-4">
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <dl className="space-y-4 p-5 text-sm">
            {details.map((row) => (
              <div key={row.label} className="space-y-0.5">
                <dt className="text-meta text-muted-foreground">{row.label}</dt>
                <dd className="text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="border-t px-5 py-4">
            <DeleteCustomerButton id={customer.id} name={customer.name} />
            <p className="mt-2 text-meta text-muted-foreground">
              Removes them from this directory. Their bookings are kept.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
