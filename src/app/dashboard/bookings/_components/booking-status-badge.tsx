import { Badge } from "@/components/ui/badge";

const STATUS: Record<string, { label: string; variant: "success" | "pending" | "destructive" }> = {
  accepted: { label: "Confirmed", variant: "success" },
  pending: { label: "Pending", variant: "pending" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  // The host action is "Decline", so the outcome reads the same way.
  rejected: { label: "Declined", variant: "destructive" },
};

/** One status vocabulary for the bookings list and the booking page. */
export function BookingStatusBadge({
  status,
  expired,
  className,
}: {
  status: string;
  /** A request nobody answered before its time passed. */
  expired?: boolean;
  className?: string;
}) {
  if (expired) {
    return (
      <Badge variant="outline" dot className={className}>
        Expired
      </Badge>
    );
  }
  const meta = STATUS[status];
  return (
    <Badge variant={meta?.variant ?? "outline"} dot className={className}>
      {meta?.label ?? status}
    </Badge>
  );
}
