import Link from "next/link";
import type { Route } from "next";
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or } from "drizzle-orm";
import {
  CalendarDays,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  History,
  Inbox,
  Search,
  SearchX,
  type LucideIcon,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/guard";
import { db } from "@/db";
import { bookings, attendees, memberships, services, teams, users } from "@/db/schema";
import { can, canAny } from "@/lib/rbac";
import type { MembershipRole } from "@/db/schema";
import { initials, resolveLocale } from "@/lib/format";
import { addDaysToKey, formatDateKey } from "@/lib/time";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { SegmentedLinks } from "@/components/ui/segmented";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { PageHeader } from "../_components/page-header";
import { AcceptButton, BookingRowMenu, DeclineButton } from "./_components/booking-actions";
import { BookingStatusBadge } from "./_components/booking-status-badge";

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

  // Scope by team members, not the service's team: bookings whose service was
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

const EMPTY: Record<Filter, { icon: LucideIcon; description: string }> = {
  upcoming: { icon: CalendarDays, description: "Share your booking page to start receiving meetings." },
  pending: { icon: Inbox, description: "Requests that need your approval will appear here." },
  past: { icon: History, description: "Meetings that have taken place will appear here." },
  cancelled: { icon: CalendarX2, description: "Cancelled and declined bookings will appear here." },
};

interface DayGroup {
  key: string;
  /** "Today", "Tomorrow" or "Yesterday" when it applies */
  relative: string | null;
  date: string;
  rows: BookingRowData[];
}

/** Rows arrive sorted by start time, so consecutive rows on the same local day form a group. */
function groupByDay(rows: BookingRowData[], timeZone: string, locale: string): DayGroup[] {
  const todayKey = formatDateKey(new Date(), timeZone);
  const relative: Record<string, string> = {
    [todayKey]: "Today",
    [addDaysToKey(todayKey, 1)]: "Tomorrow",
    [addDaysToKey(todayKey, -1)]: "Yesterday",
  };
  const sameYear = new Intl.DateTimeFormat(locale, { timeZone, weekday: "long", day: "numeric", month: "long" });
  const otherYear = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const groups: DayGroup[] = [];
  for (const row of rows) {
    const key = formatDateKey(row.startTime, timeZone);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.rows.push(row);
      continue;
    }
    const format = key.slice(0, 4) === todayKey.slice(0, 4) ? sameYear : otherYear;
    groups.push({ key, relative: relative[key] ?? null, date: format.format(row.startTime), rows: [row] });
  }
  return groups;
}

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
  const showProvider = can(role, "booking.all.view");
  // Same check as the services page itself, so members get "My services" and a
  // role that cannot open the page is not sent to one that refuses it.
  const canOpenServices = canAny(role, [
    "service.catalog.view",
    "service.catalog.manage",
    "service.assigned.view",
  ]);
  const filtered = Boolean(q || serviceId || hostId);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const locale = resolveLocale(user.locale);
  const timeFormat = new Intl.DateTimeFormat(locale, {
    timeZone: user.timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: user.timeFormat === 12,
  });
  const groups = groupByDay(rows, user.timeZone, locale);
  const empty = EMPTY[active];

  const queryFor = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { tab: active, q, service: params.service, host: params.host, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    return `/dashboard/bookings?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" description="Upcoming, pending and past meetings." />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedLinks
          aria-label="Booking status"
          className="self-start lg:self-auto"
          items={FILTERS.map((f) => ({
            href: queryFor({ tab: f, page: undefined }),
            label: FILTER_LABELS[f],
            active: f === active,
          }))}
        />

        {/* A GET form, so a filtered list is a shareable URL. */}
        <form className="flex flex-wrap items-center gap-2" action="/dashboard/bookings">
          <input type="hidden" name="tab" value={active} />
          <div className="relative w-full sm:w-60">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search name, email or title"
              aria-label="Search bookings"
              className="h-8 pl-8 text-meta"
            />
          </div>
          {serviceOptions.length > 1 ? (
            <FilterSelect
              name="service"
              ariaLabel="Filter by service"
              defaultValue={params.service || "all"}
              options={[
                { value: "all", label: "All services" },
                ...serviceOptions.map((s) => ({ value: String(s.id), label: s.title })),
              ]}
            />
          ) : null}
          {providerOptions.length > 1 ? (
            <FilterSelect
              name="host"
              ariaLabel="Filter by provider"
              defaultValue={params.host || "all"}
              options={[
                { value: "all", label: "All providers" },
                ...providerOptions.map((p) => ({ value: String(p.id), label: p.name })),
              ]}
            />
          ) : null}
          <Button type="submit" size="sm" variant="outline">
            Apply
          </Button>
          {filtered ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={`/dashboard/bookings?tab=${active}` as Route}>Clear</Link>
            </Button>
          ) : null}
        </form>
      </div>

      {rows.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={SearchX}
            title="No matching bookings"
            description="Try different search terms or clear the filters."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/bookings?tab=${active}` as Route}>Clear filters</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={empty.icon}
            title={`No ${active} bookings`}
            description={empty.description}
            action={
              active === "upcoming" && canOpenServices ? (
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/services">Manage services</Link>
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="space-y-4">
          <Card className="divide-y overflow-hidden">
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`day-${group.key}`}>
                <h2
                  id={`day-${group.key}`}
                  className="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2 text-meta font-medium text-muted-foreground sm:px-5"
                >
                  {group.relative ? (
                    <>
                      <span className="text-foreground">{group.relative}</span>
                      <span aria-hidden>·</span>
                    </>
                  ) : null}
                  {group.date}
                </h2>
                <div className="divide-y">
                  {group.rows.map((booking) => (
                    <BookingRow
                      key={booking.uid}
                      booking={booking}
                      filter={active}
                      timeFormat={timeFormat}
                      canManage={canManage}
                      showProvider={showProvider}
                    />
                  ))}
                </div>
              </section>
            ))}
          </Card>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-meta tabular-nums text-muted-foreground">
                Page {page} of {totalPages} · {total} booking{total === 1 ? "" : "s"}
              </p>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={queryFor({ page: String(page - 1) }) as Route}>
                      <ChevronLeft />
                      Previous
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled>
                    <ChevronLeft />
                    Previous
                  </Button>
                )}
                {page < totalPages ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={queryFor({ page: String(page + 1) }) as Route}>
                      Next
                      <ChevronRight />
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled>
                    Next
                    <ChevronRight />
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function BookingRow({
  booking,
  filter,
  timeFormat,
  canManage,
  showProvider,
}: {
  booking: BookingRowData;
  filter: Filter;
  timeFormat: Intl.DateTimeFormat;
  canManage: boolean;
  showProvider: boolean;
}) {
  const expired = booking.status === "pending" && booking.endTime.getTime() < Date.now();
  const [primary, ...guests] = booking.attendeeNames;
  const attendee = primary
    ? guests.length > 0
      ? `${primary} + ${guests.length} guest${guests.length === 1 ? "" : "s"}`
      : primary
    : "No attendee";

  const location = booking.location ? (
    booking.meetingUrl ? (
      <a
        href={booking.meetingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative z-10 hover:text-foreground hover:underline"
      >
        {booking.location}
      </a>
    ) : (
      booking.location
    )
  ) : null;

  return (
    <div className="group relative flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-nowrap sm:px-5">
      {/* Stretched link: the whole row opens the booking. Controls inside the
          row (meeting link, actions) sit above it. */}
      <Link
        href={`/dashboard/bookings/${booking.uid}` as Route}
        aria-label={`Open booking: ${booking.title}`}
        className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />

      <div className="w-20 shrink-0 whitespace-nowrap tabular-nums">
        <p className="text-sm font-medium text-foreground">{timeFormat.format(booking.startTime)}</p>
        <p className="text-meta text-muted-foreground">{timeFormat.format(booking.endTime)}</p>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{booking.title}</p>
        <p className="truncate text-meta text-muted-foreground">
          {attendee}
          {location ? <span className="max-sm:hidden"> · {location}</span> : null}
          {booking.hostName ? <span className="md:hidden"> · with {booking.hostName}</span> : null}
        </p>
        {/* On phones the location leaves the line above. A meeting link gets a
            line of its own so a long name cannot truncate it out of reach. */}
        {booking.meetingUrl && location ? (
          <p className="truncate text-meta text-muted-foreground sm:hidden">{location}</p>
        ) : null}
      </div>

      {showProvider ? (
        <div className="hidden w-40 shrink-0 items-center gap-2 md:flex">
          {booking.hostName ? (
            <>
              <Avatar className="h-6 w-6">
                <AvatarFallback>{initials(booking.hostName)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-meta text-muted-foreground">{booking.hostName}</span>
            </>
          ) : (
            <span className="text-meta text-muted-foreground">Unassigned</span>
          )}
        </div>
      ) : null}

      {/* Confirmed is the norm, so phones drop that badge to save room. */}
      <div className={cn("flex shrink-0 sm:w-24", booking.status === "accepted" && "max-sm:hidden")}>
        <BookingStatusBadge status={booking.status} expired={expired} />
      </div>

      {canManage && filter === "pending" ? (
        <div className="relative z-10 flex shrink-0 items-center gap-2 max-sm:basis-full max-sm:pl-24">
          <DeclineButton uid={booking.uid} variant="ghost" />
          <AcceptButton uid={booking.uid} variant="outline" />
        </div>
      ) : canManage && filter === "upcoming" ? (
        <div className="relative z-10 shrink-0">
          <BookingRowMenu uid={booking.uid} title={booking.title} rescheduleHref={booking.rescheduleHref} />
        </div>
      ) : (
        // Same width as the row menu button, so columns line up across tabs.
        <span className="flex w-8 shrink-0 justify-center" aria-hidden>
          <ChevronRight className="size-4 text-muted-foreground/60 transition-colors group-hover:text-muted-foreground" />
        </span>
      )}
    </div>
  );
}
