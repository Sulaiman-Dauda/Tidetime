import Link from "next/link";
import type { Route } from "next";
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or } from "drizzle-orm";
import { requireAnyPermission } from "@/lib/guard";
import { db } from "@/db";
import { bookings, attendees, memberships, services, teams, users } from "@/db/schema";
import { can } from "@/lib/rbac";
import type { MembershipRole } from "@/db/schema";
import { formatRange } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "../_components/page-header";
import { EmptyState } from "@/components/empty-state";
import { CancelBookingButton, AcceptButton, DeclineButton } from "./_components/booking-actions";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, MapPin, User, X } from "lucide-react";

type Filter = "upcoming" | "pending" | "past" | "cancelled";

const PAGE_SIZE = 50;

interface BookingRowData {
  uid: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location: string | null;
  meetingUrl: string | null;
  status: string;
  attendeeNames: string[];
  hostName: string | null;
  /** public reschedule flow entry point, when the service still exists */
  rescheduleHref: string | null;
}

interface LoadResult {
  rows: BookingRowData[];
  total: number;
  serviceOptions: { id: number; title: string }[];
  providerOptions: { id: number; name: string }[];
}

async function loadBookings(
  userId: number,
  teamId: number,
  role: MembershipRole,
  filter: Filter,
  opts: { q?: string; serviceId?: number; hostId?: number; page: number },
): Promise<LoadResult> {
  const now = new Date();

  // Scope by team members, not the service's team — bookings whose service was
  // deleted must not vanish for team-wide viewers.
  const teamWide = can(role, "booking.all.view");
  const memberRows = await db
    .select({ userId: memberships.userId, name: users.name, username: users.username })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.teamId, teamId), eq(memberships.accepted, true)))
    .orderBy(asc(users.name));
  const scopeIds = teamWide ? memberRows.map((row) => row.userId) : [userId];

  // Team scope covers current members' bookings AND this team's services, so
  // neither a deleted service nor a removed member hides a real meeting.
  const conditions = [
    teamWide
      ? or(inArray(bookings.userId, scopeIds), eq(services.teamId, teamId))!
      : inArray(bookings.userId, scopeIds),
  ];
  if (filter === "upcoming") {
    conditions.push(eq(bookings.status, "accepted"), gte(bookings.endTime, now));
  } else if (filter === "pending") {
    conditions.push(eq(bookings.status, "pending"));
  } else if (filter === "past") {
    conditions.push(eq(bookings.status, "accepted"), lt(bookings.endTime, now));
  } else {
    conditions.push(inArray(bookings.status, ["cancelled", "rejected"]));
  }
  if (opts.serviceId) conditions.push(eq(bookings.serviceId, opts.serviceId));
  if (opts.hostId && teamWide) conditions.push(eq(bookings.userId, opts.hostId));

  const search = opts.q?.trim();
  if (search) {
    const like = `%${search}%`;
    const matching = db
      .select({ bookingId: attendees.bookingId })
      .from(attendees)
      .where(or(ilike(attendees.name, like), ilike(attendees.email, like)));
    conditions.push(or(ilike(bookings.title, like), inArray(bookings.id, matching))!);
  }

  const where = and(...conditions);
  const [{ value: total } = { value: 0 }] = await db
    .select({ value: count() })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(where);

  const rows = await db
    .select({
      booking: bookings,
      serviceTitle: services.title,
      serviceSlug: services.slug,
      teamSlug: teams.slug,
      hostName: users.name,
      hostUsername: users.username,
    })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(teams, eq(teams.id, services.teamId))
    .leftJoin(users, eq(users.id, bookings.userId))
    .where(where)
    .orderBy(
      filter === "past" || filter === "cancelled"
        ? desc(bookings.startTime)
        : bookings.startTime,
    )
    .limit(PAGE_SIZE)
    .offset((opts.page - 1) * PAGE_SIZE);

  const serviceOptions = await db
    .select({ id: services.id, title: services.title })
    .from(services)
    .where(eq(services.teamId, teamId))
    .orderBy(asc(services.position));

  const bookingIds = rows.map((r) => r.booking.id);
  const ats = bookingIds.length
    ? await db.select().from(attendees).where(inArray(attendees.bookingId, bookingIds))
    : [];
  const byBooking = new Map<number, typeof ats>();
  for (const a of ats) {
    const list = byBooking.get(a.bookingId) ?? [];
    list.push(a);
    byBooking.set(a.bookingId, list);
  }

  return {
    total,
    serviceOptions,
    providerOptions: teamWide
      ? memberRows.map((m) => ({ id: m.userId, name: m.name ?? m.username }))
      : [],
    rows: rows.map(({ booking, serviceTitle, serviceSlug, teamSlug, hostName, hostUsername }) => {
      const list = byBooking.get(booking.id) ?? [];
      const sorted = [...list.filter((a) => a.isPrimary), ...list.filter((a) => !a.isPrimary)];
      return {
        uid: booking.uid,
        title: serviceTitle ?? booking.title,
        startTime: booking.startTime,
        endTime: booking.endTime,
        location: booking.location,
        meetingUrl: booking.meetingUrl,
        status: booking.status,
        attendeeNames: sorted.map((a) => a.name),
        hostName: teamWide ? hostName ?? hostUsername ?? null : null,
        rescheduleHref:
          teamSlug && serviceSlug ? `/book/${teamSlug}/${serviceSlug}?reschedule=${booking.uid}` : null,
      };
    }),
  };
}

interface Props {
  searchParams: Promise<{ tab?: string; q?: string; service?: string; host?: string; page?: string }>;
}

const FILTERS: Filter[] = ["upcoming", "pending", "past", "cancelled"];
const FILTER_LABELS: Record<Filter, string> = {
  upcoming: "Upcoming",
  pending: "Pending",
  past: "Past",
  cancelled: "Cancelled",
};

export default async function BookingsPage({ searchParams }: Props) {
  const { user, role, teamId } = await requireAnyPermission([
    "booking.own.view",
    "booking.all.view",
  ]);
  const params = await searchParams;
  const active: Filter = FILTERS.includes(params.tab as Filter) ? (params.tab as Filter) : "upcoming";
  const page = Math.max(1, Number(params.page) || 1);
  const serviceId = Number(params.service) || undefined;
  const hostId = Number(params.host) || undefined;
  const q = params.q?.trim() || undefined;

  const { rows, total, serviceOptions, providerOptions } = await loadBookings(
    user.id,
    teamId,
    role,
    active,
    { q, serviceId, hostId, page },
  );
  const canManage = can(role, "booking.all.manage") || can(role, "booking.own.manage");
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hour12 = user.timeFormat === 12;
  const locale = user.locale;

  const queryFor = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { tab: active, q, service: params.service, host: params.host, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    return `/dashboard/bookings?${next.toString()}`;
  };

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Bookings"
        description="Upcoming, pending, and historical meetings."
      />

      <Tabs value={active}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="flex-wrap">
            {FILTERS.map((f) => (
              <TabsTrigger key={f} value={f} asChild>
                <Link href={queryFor({ tab: f, page: undefined }) as Route}>{FILTER_LABELS[f]}</Link>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Search + filters — GET form so results are linkable */}
          <form className="flex flex-wrap items-center gap-2" action="/dashboard/bookings">
            <input type="hidden" name="tab" value={active} />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search name, email or title…"
              className="h-8 w-52 rounded-lg border border-input bg-card px-2.5 text-[13px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {serviceOptions.length > 1 ? (
              <select
                name="service"
                defaultValue={params.service ?? ""}
                className="h-8 rounded-lg border border-input bg-card px-2 text-[13px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Filter by service"
              >
                <option value="">All services</option>
                {serviceOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            ) : null}
            {providerOptions.length > 1 ? (
              <select
                name="host"
                defaultValue={params.host ?? ""}
                className="h-8 rounded-lg border border-input bg-card px-2 text-[13px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Filter by provider"
              >
                <option value="">All providers</option>
                {providerOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ) : null}
            <Button type="submit" size="sm" variant="outline" className="h-8">
              Apply
            </Button>
          </form>
        </div>

        <TabsContent value={active} className="mt-6">
          {rows.length === 0 ? (
            <EmptyState
              brand
              title={q || serviceId || hostId ? "No matching bookings" : `No ${active} bookings`}
              description={
                q || serviceId || hostId
                  ? "Try different search terms or clear the filters."
                  : active === "upcoming"
                    ? "Share your booking link to start receiving meetings."
                    : "Nothing to show here yet."
              }
              action={
                q || serviceId || hostId ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/bookings?tab=${active}` as Route}>Clear filters</Link>
                  </Button>
                ) : active === "upcoming" ? (
                  <Button asChild size="sm">
                    <Link href="/dashboard/services">Manage services</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="divide-y divide-border rounded-2xl border border-border/60 bg-card">
                {rows.map((b, i) => (
                  <BookingRow
                    key={b.uid}
                    booking={b}
                    filter={active}
                    userTz={user.timeZone}
                    hour12={hour12}
                    locale={locale}
                    canManage={canManage}
                    index={i}
                  />
                ))}
              </div>
              {totalPages > 1 ? (
                <div className="mt-4 flex items-center justify-between text-[13px] text-muted-foreground">
                  <span>
                    Page {page} of {totalPages} · {total} booking{total === 1 ? "" : "s"}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BookingRow({
  booking,
  filter,
  userTz,
  hour12,
  locale,
  canManage,
  index,
}: {
  booking: BookingRowData;
  filter: Filter;
  userTz: string;
  hour12: boolean;
  locale: string;
  canManage: boolean;
  index: number;
}) {
  const when = formatRange(booking.startTime, booking.endTime, userTz, hour12, locale);
  const expired = filter === "pending" && booking.endTime.getTime() < Date.now();
  const attendeeSummary =
    booking.attendeeNames.length <= 1
      ? booking.attendeeNames[0]
      : `${booking.attendeeNames[0]} + ${booking.attendeeNames.length - 1} guest${booking.attendeeNames.length - 1 === 1 ? "" : "s"}`;

  return (
    <div
      className="tt-rise group relative flex flex-col gap-3 px-5 py-4 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-secondary/30 sm:flex-row sm:items-center sm:justify-between"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      {/* Stretched link: the whole row navigates to the booking. Inner
          interactive elements (meeting link, actions) sit above it via z-10. */}
      <Link
        href={`/dashboard/bookings/${booking.uid}`}
        aria-label={`Open booking: ${booking.title}`}
        className="absolute inset-0 z-0 rounded-[inherit] focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground group-hover:underline">
            {booking.title}
            {booking.hostName ? (
              <span className="font-normal text-muted-foreground"> · {booking.hostName}</span>
            ) : null}
          </span>
          {booking.status === "pending" && (
            <Badge variant="pending" className="gap-1">
              <Clock className="h-2.5 w-2.5" /> Pending
            </Badge>
          )}
          {expired && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              Time has passed
            </Badge>
          )}
          {booking.status === "cancelled" && (
            <Badge variant="destructive" className="gap-1">
              <X className="h-2.5 w-2.5" />
              Cancelled
            </Badge>
          )}
          {booking.status === "rejected" && (
            <Badge variant="destructive" className="gap-1">
              <X className="h-2.5 w-2.5" />
              Rejected
            </Badge>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {when}
          </span>
          {attendeeSummary && (
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {attendeeSummary}
            </span>
          )}
          {booking.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {booking.meetingUrl ? (
                <a
                  href={booking.meetingUrl}
                  className="relative z-10 hover:text-foreground hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {booking.location}
                </a>
              ) : (
                booking.location
              )}
            </span>
          )}
        </div>
      </div>

      {canManage && filter === "pending" && (
        <div className="relative z-10 flex shrink-0 items-center gap-2">
          <DeclineButton uid={booking.uid} />
          <AcceptButton uid={booking.uid} />
        </div>
      )}

      {canManage && filter === "upcoming" && (
        <div className="relative z-10 flex shrink-0 items-center gap-2">
          {booking.rescheduleHref ? (
            <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
              <Link href={booking.rescheduleHref as Route}>
                <CalendarClock className="h-3.5 w-3.5" />
                Reschedule
              </Link>
            </Button>
          ) : null}
          <CancelBookingButton uid={booking.uid} />
        </div>
      )}
    </div>
  );
}
