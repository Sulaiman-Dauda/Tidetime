import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/guard";
import { getCustomerWithBookings } from "@/server/customers";
import { formatRange } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "../../_components/page-header";
import { DeleteCustomerButton } from "./delete-customer-button";
import { ArrowLeft, Mail, Phone, Globe2 } from "lucide-react";

export const metadata = { title: "Customer" };

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "pending" | "destructive" }> = {
  accepted: { label: "Confirmed", variant: "default" },
  pending: { label: "Pending", variant: "pending" },
  cancelled: { label: "Cancelled", variant: "destructive" },
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

  const sinceFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: user.timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to customers
        </Link>
        <PageHeader
          title={customer.name}
          description={`Customer since ${sinceFmt.format(new Date(customer.createdAt))}`}
          action={<DeleteCustomerButton id={customer.id} name={customer.name} />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
        <Card className="space-y-3 p-5 text-sm">
          <h2 className="text-sm font-semibold">Contact</h2>
          <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{customer.email}</span>
          </a>
          {customer.phoneNumber ? (
            <a href={`tel:${customer.phoneNumber}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {customer.phoneNumber}
            </a>
          ) : null}
          {customer.timeZone ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Globe2 className="h-3.5 w-3.5 shrink-0" />
              {customer.timeZone.replace(/_/g, " ")}
            </p>
          ) : null}
          <p className="border-t border-border/60 pt-3 text-muted-foreground">
            {customer.bookingsCount} active booking{customer.bookingsCount === 1 ? "" : "s"} made
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Booking history</h2>
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No bookings found for this customer.</p>
          ) : (
            <div className="mt-4 divide-y divide-border/50">
              {history.map((b) => {
                const badge = STATUS_BADGES[b.status] ?? { label: b.status, variant: "default" as const };
                return (
                  <Link
                    key={b.uid}
                    href={`/dashboard/bookings/${b.uid}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm transition-colors hover:bg-secondary/20"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{b.serviceTitle ?? b.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatRange(b.startTime, b.endTime, user.timeZone, hour12)}
                        {b.location ? ` · ${b.location}` : ""}
                      </p>
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
