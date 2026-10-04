"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ChevronLeft, ChevronRight, Clock, MapPin, User, CalendarX2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "../_components/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WEEKDAY_SHORT } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getZonedParts, zonedTimeToUtc } from "@/lib/time";
import { useToast } from "@/hooks/use-toast";
import { moveBookingAction } from "./actions";
import { QuickBookingDialog, type CalendarService } from "./quick-booking-dialog";

export interface CalendarEvent {
  uid: string;
  title: string;
  start: string;
  end: string;
  status: "accepted" | "pending";
  location: string | null;
  attendee: string | null;
  hostId: number | null;
  /** set only for team-wide viewers */
  hostName: string | null;
}

interface Props {
  year: number;
  month: number;
  events: CalendarEvent[];
  /** the month had more events than the query limit, so some are not shown */
  truncated: boolean;
  timeZone: string;
  hour12: boolean;
  /** BCP-47 locale for date/time rendering */
  locale?: string;
  /** 0=Sunday .. 6=Saturday, from the viewer's profile */
  weekStart: number;
  services: CalendarService[];
  /** team roster for the provider filter; empty for member-scoped viewers */
  teamMembers: { id: number; name: string }[];
}

/** YYYY-MM-DD for an instant rendered in a specific timezone (en-CA → ISO order). */
function dayKeyInTz(iso: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/**
 * Month grid of day keys. Cells are plain "YYYY-MM-DD" strings, the same
 * vocabulary events are bucketed in, so no browser-local Date conversion can
 * shift a booking onto the wrong cell.
 */
function monthMatrix(year: number, month: number, weekStart: number): (string | null)[][] {
  const startDay = (new Date(year, month, 1).getDay() - weekStart + 7) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export function CalendarView({
  year,
  month,
  events: allEvents,
  truncated,
  timeZone,
  hour12,
  locale = "en-US",
  weekStart,
  services,
  teamMembers,
}: Props) {
  const rows = useMemo(() => monthMatrix(year, month, weekStart), [year, month, weekStart]);
  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => WEEKDAY_SHORT[(i + weekStart) % 7]),
    [weekStart],
  );
  // Provider filter for team-wide viewers.
  const [filterHostId, setFilterHostId] = useState<number | null>(null);
  const events = useMemo(
    () => (filterHostId === null ? allEvents : allEvents.filter((e) => e.hostId === filterHostId)),
    [allEvents, filterHostId],
  );

  function timeInTz(iso: string): string {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12,
    }).format(new Date(iso));
  }

  /**
   * Month cells are under 100px wide, and a full "10:00 AM" left almost nothing for
   * the title. Drop a zero minute and the space before the meridiem, the way
   * every other month grid does: "9am", "9:45am".
   */
  function compactTimeInTz(iso: string): string {
    return timeInTz(iso)
      .replace(/:00(?=\s*[AaPp][Mm]|$)/, "")
      .replace(/\s+([AaPp][Mm])/, "$1")
      .toLowerCase();
  }
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startMove] = useTransition();
  const [dragUid, setDragUid] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  // Drag-to-create: dragging from an empty day cell (not a booking chip) arms a
  // create gesture; dropping on a day opens the quick-create dialog for it.
  const [createFrom, setCreateFrom] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | null>(null);

  function openCreate(dayKey: string) {
    setCreateFrom(null);
    setCreateDate(dayKey);
    setCreateOpen(true);
  }

  // Drag an event onto another day to reschedule it, preserving the time-of-day
  // in the host's timezone. The booking's calendar invite + attendee email are
  // refreshed server-side with a bumped SEQUENCE.
  function handleDrop(targetDayKey: string) {
    const uid = dragUid;
    setDragUid(null);
    setDropKey(null);
    if (!uid) return;
    const ev = events.find((e) => e.uid === uid);
    if (!ev) return;
    const sourceDayKey = dayKeyInTz(ev.start, timeZone);
    if (sourceDayKey === targetDayKey) return;

    const parts = getZonedParts(new Date(ev.start), timeZone);
    const [ty, tm, td] = targetDayKey.split("-").map(Number);
    const newStart = zonedTimeToUtc(ty, tm, td, parts.hour, parts.minute, timeZone);

    startMove(async () => {
      const res = await moveBookingAction(uid, newStart.toISOString());
      if (res?.ok) {
        toast({ title: "Booking moved", description: "An updated invite was sent to the attendee." });
        router.refresh();
      } else {
        toast({ title: "Couldn't move booking", description: res?.error, variant: "destructive" });
      }
    });
  }

  // Bucket events by their day in the host's timezone.
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = dayKeyInTz(e.start, timeZone);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events, timeZone]);

  // "Today" in the profile timezone: the browser's clock must not decide
  // which cell gets the highlight.
  const todayKey = dayKeyInTz(new Date(), timeZone);
  const defaultSelected = useMemo(() => {
    const visibleDays = rows.flat().filter((d): d is string => Boolean(d));
    if (visibleDays.includes(todayKey)) return todayKey;
    const firstWithEvents = visibleDays.find((key) => (byDay.get(key)?.length ?? 0) > 0);
    return firstWithEvents ?? visibleDays[0] ?? null;
  }, [rows, todayKey, byDay]);
  const [selected, setSelected] = useState<string | null>(defaultSelected);

  useEffect(() => {
    setSelected(defaultSelected);
  }, [defaultSelected]);

  const prev = month === 0 ? monthKey(year - 1, 11) : monthKey(year, month - 1);
  const next = month === 11 ? monthKey(year + 1, 0) : monthKey(year, month + 1);
  const [todayYear, todayMonth] = todayKey.split("-").map(Number);
  const thisMonth = monthKey(todayYear, todayMonth - 1);

  const monthLabel = new Date(year, month, 1).toLocaleString(locale, {
    month: "long",
    year: "numeric",
  });

  const selectedEvents = selected ? byDay.get(selected) ?? [] : [];
  const selectedLabel = selected
    ? new Date(`${selected}T00:00:00`).toLocaleDateString(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null;

  const cells = rows.flat();
  const lastRowStart = cells.length - 7;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Drag a booking to another day to reschedule it, or use + on a day to add one."
        action={
          teamMembers.length > 1 ? (
            <Select
              value={filterHostId === null ? "all" : String(filterHostId)}
              onValueChange={(value) => setFilterHostId(value === "all" ? null : Number(value))}
            >
              <SelectTrigger aria-label="Filter by provider" className="h-8 w-auto min-w-36 text-meta">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All providers</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={String(member.id)}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />

      {truncated ? (
        <p
          role="status"
          className="rounded-lg border border-warning/20 bg-warning-subtle px-4 py-3 text-sm text-warning"
        >
          This month has more bookings than the calendar can show, so some are hidden. Use the
          provider filter or the Bookings page to see everything.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
        {/* Sticky beside the day rail, so the month stays in view while a busy
            day's bookings scroll. */}
        <Card className="xl:sticky xl:top-6">
          <div className="flex h-14 items-center justify-between gap-3 border-b px-4">
            <h2 className="text-base font-semibold tracking-tight">{monthLabel}</h2>
            <div className="flex items-center">
              <Button
                asChild
                variant="outline"
                size="icon-sm"
                className="rounded-r-none focus-visible:z-10"
              >
                <Link href={`/dashboard/calendar?month=${prev}` as Route} aria-label="Previous month">
                  <ChevronLeft />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="-ml-px rounded-none focus-visible:z-10"
              >
                <Link href={`/dashboard/calendar?month=${thisMonth}` as Route}>Today</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="icon-sm"
                className="-ml-px rounded-l-none focus-visible:z-10"
              >
                <Link href={`/dashboard/calendar?month=${next}` as Route} aria-label="Next month">
                  <ChevronRight />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
            {weekdays.map((d) => (
              <div key={d} className="py-2 text-center sm:px-3 sm:text-left">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((key, i) => {
              const edges = cn((i + 1) % 7 !== 0 && "border-r", i < lastRowStart && "border-b");
              if (!key) return <div key={i} className={cn("min-h-14 bg-muted/40 sm:min-h-28", edges)} />;
              const dayEvents = byDay.get(key) ?? [];
              const isToday = key === todayKey;
              const isSelected = key === selected;
              const isDropTarget = dropKey === key && (dragUid !== null || createFrom !== null);
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  // Dragging from empty space on a day arms a create gesture
                  // (booking chips stop propagation so their drag reschedules).
                  draggable
                  onDragStart={(ev) => {
                    if (dragUid) return;
                    setCreateFrom(key);
                    ev.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => setSelected(key)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      setSelected(key);
                    }
                  }}
                  onDragOver={(ev) => {
                    if (dragUid || createFrom) {
                      ev.preventDefault();
                      if (dropKey !== key) setDropKey(key);
                    }
                  }}
                  onDragLeave={() => setDropKey((cur) => (cur === key ? null : cur))}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    if (dragUid) handleDrop(key);
                    else if (createFrom) openCreate(key);
                  }}
                  onDragEnd={() => {
                    setCreateFrom(null);
                    setDropKey(null);
                  }}
                  className={cn(
                    "group min-h-14 cursor-pointer p-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40 sm:min-h-28 sm:p-1.5",
                    edges,
                    isSelected ? "bg-accent/50" : "hover:bg-muted/40",
                    isDropTarget && "bg-accent ring-2 ring-inset ring-primary/40",
                    pending && "opacity-60",
                  )}
                >
                  <div className="flex items-center justify-center sm:justify-between">
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-meta font-medium tabular-nums",
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : isSelected
                            ? "font-semibold text-accent-foreground"
                            : "text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      {Number(key.slice(-2))}
                    </span>
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        openCreate(key);
                      }}
                      aria-label={`Add booking on ${key}`}
                      className="hidden size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none transition-[color,background-color,opacity] hover:bg-secondary hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40 group-hover:opacity-100 sm:flex"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>

                  {/* Phones get dots: a 50px cell has no room for a readable chip,
                      and tapping the day lists its bookings below. */}
                  {dayEvents.length > 0 ? (
                    <div className="mt-1 flex justify-center gap-0.5 sm:hidden" aria-hidden>
                      {dayEvents.slice(0, 3).map((e) => (
                        <span
                          key={e.uid}
                          className={cn(
                            "size-1.5 rounded-full",
                            e.status === "pending" ? "bg-warning" : "bg-primary",
                          )}
                        />
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-1 hidden space-y-0.5 sm:block">
                    {dayEvents.slice(0, 3).map((e) => (
                      <div
                        key={e.uid}
                        draggable
                        onDragStart={(ev) => {
                          ev.stopPropagation();
                          setDragUid(e.uid);
                          ev.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDragUid(null);
                          setDropKey(null);
                        }}
                        className={cn(
                          "cursor-grab truncate rounded-md px-1.5 text-xs font-medium leading-5 active:cursor-grabbing",
                          e.status === "pending"
                            ? "bg-warning-subtle text-warning"
                            : "bg-accent text-accent-foreground",
                          dragUid === e.uid && "opacity-40",
                        )}
                        title={`${timeInTz(e.start)} ${e.title}${e.hostName ? ` · ${e.hostName}` : ""}\nDrag to another day to reschedule`}
                      >
                        <span className="font-normal tabular-nums opacity-80">{compactTimeInTz(e.start)}</span>{" "}
                        {e.title}
                        {e.hostName ? <span className="font-normal opacity-80"> · {e.hostName}</span> : null}
                      </div>
                    ))}
                    {dayEvents.length > 3 ? (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSelected(key);
                        }}
                        className="w-full rounded-md px-1.5 text-left text-xs font-medium leading-5 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        +{dayEvents.length - 3} more
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 border-t px-4 py-2.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" aria-hidden />
              Confirmed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-warning" aria-hidden />
              Awaiting approval
            </span>
            {/* The viewer's display zone, not a schedule's zone. A bare "Times
                in UTC" read as a contradiction next to a schedule set in
                Europe/London, so say whose it is and where to change it. */}
            <Link
              href={"/dashboard/account" as Route}
              className="ml-auto hidden transition-colors hover:text-foreground sm:block"
              title="Shown in your profile time zone. Click to change it."
            >
              Your time zone · {timeZone.replace(/_/g, " ")}
            </Link>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex h-14 items-center justify-between gap-3 border-b px-4">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{selectedLabel ?? "Select a day"}</h2>
              <p className="text-meta text-muted-foreground tabular-nums">
                {selectedEvents.length === 0
                  ? "No bookings"
                  : `${selectedEvents.length} booking${selectedEvents.length === 1 ? "" : "s"}`}
              </p>
            </div>
            {selected ? (
              <Button size="sm" variant="outline" onClick={() => openCreate(selected)}>
                <Plus />
                New
              </Button>
            ) : null}
          </div>

          {selectedEvents.length === 0 ? (
            <EmptyState bare icon={CalendarX2} title="Nothing scheduled" className="py-10" />
          ) : (
            <ul className="divide-y">
              {selectedEvents.map((e) => (
                <li key={e.uid}>
                  <Link
                    href={`/dashboard/bookings/${e.uid}` as Route}
                    className="block px-4 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-medium">{e.title}</p>
                      {e.status === "pending" ? <Badge variant="pending">Pending</Badge> : null}
                    </div>
                    <div className="mt-1.5 space-y-1 text-meta text-muted-foreground">
                      <p className="flex items-center gap-2 tabular-nums">
                        <Clock className="size-3.5 shrink-0" />
                        {timeInTz(e.start)} – {timeInTz(e.end)}
                      </p>
                      {e.attendee ? (
                        <p className="flex items-center gap-2">
                          <User className="size-3.5 shrink-0" />
                          <span className="truncate">
                            {e.attendee}
                            {e.hostName ? ` with ${e.hostName}` : null}
                          </span>
                        </p>
                      ) : null}
                      {e.location ? (
                        <p className="flex items-center gap-2">
                          <MapPin className="size-3.5 shrink-0" />
                          <span className="truncate">{e.location}</span>
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <QuickBookingDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        date={createDate}
        locale={locale}
        services={services}
        providers={teamMembers}
      />
    </div>
  );
}
