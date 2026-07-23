"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ChevronLeft, ChevronRight, Clock, MapPin, User, CalendarX2, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  /** the month had more events than the query limit — some are not shown */
  truncated: boolean;
  timeZone: string;
  hour12: boolean;
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
 * Month grid of day keys. Cells are plain "YYYY-MM-DD" strings — the same
 * vocabulary events are bucketed in — so no browser-local Date conversion can
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
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12,
    }).format(new Date(iso));
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

  // "Today" in the profile timezone — the browser's clock must not decide
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

  const monthLabel = new Date(year, month, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const selectedEvents = selected ? byDay.get(selected) ?? [] : [];
  const selectedLabel = selected
    ? new Date(`${selected}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            A month-at-a-glance view — drag a booking to reschedule, or drag (or tap +) on a day to
            add one.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {teamMembers.length > 1 ? (
            <select
              aria-label="Filter by provider"
              value={filterHostId === null ? "all" : String(filterHostId)}
              onChange={(ev) => setFilterHostId(ev.target.value === "all" ? null : Number(ev.target.value))}
              className="h-8 rounded-xl border bg-card px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All providers</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/calendar?month=${thisMonth}` as Route}>Today</Link>
          </Button>
          <div className="flex items-center rounded-xl border bg-card shadow-sm">
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-r-none">
              <Link href={`/dashboard/calendar?month=${prev}` as Route} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <span className="w-36 text-center text-sm font-medium tabular-nums">{monthLabel}</span>
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-l-none">
              <Link href={`/dashboard/calendar?month=${next}` as Route} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {truncated ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
          This month has more bookings than the calendar can display — some are hidden. Use the
          provider filter or the Bookings page to see everything.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
        {/* Month grid — sticky on desktop so it stays in view while a busy day's
            bookings scroll in the rail. Offset clears the sticky top bar (h-14). */}
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card lg:sticky lg:top-[72px] lg:self-start">
          <div className="grid grid-cols-7 border-b border-border/50 bg-muted/30 text-center text-xs font-semibold text-foreground/60">
            {weekdays.map((d) => (
              <div key={d} className="py-2.5">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {rows.flat().map((key, i) => {
              if (!key) return <div key={i} className="min-h-[104px] border-b border-r border-border/50 bg-muted/10" />;
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
                    "group relative min-h-[104px] cursor-pointer border-b border-r border-border/50 p-1.5 text-left align-top transition-all last:border-r-0 hover:bg-primary/8",
                    isSelected && "bg-primary/12 ring-1 ring-inset ring-primary/20",
                    isDropTarget && "bg-primary/15 ring-2 ring-inset ring-primary/50",
                    pending && "opacity-60",
                    (i + 1) % 7 === 0 && "border-r-0",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                        isToday
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-foreground/70 group-hover:text-foreground",
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
                      className="flex h-5 w-5 items-center justify-center rounded-md text-foreground/40 opacity-0 transition-all hover:bg-primary/15 hover:text-primary focus:opacity-100 group-hover:opacity-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-1 space-y-1">
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
                          "cursor-grab truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-tight active:cursor-grabbing",
                          dragUid === e.uid && "opacity-40",
                          e.status === "pending"
                            ? "bg-amber-500/20 text-amber-800 dark:bg-amber-500/25 dark:text-amber-200"
                            : "bg-primary/20 text-foreground dark:bg-primary/25 dark:text-foreground",
                        )}
                        title={`${e.title} — drag to another day to reschedule`}
                      >
                        <span className="tabular-nums opacity-70">{timeInTz(e.start)}</span>{" "}
                        {e.title}
                        {e.hostName ? <span className="opacity-60"> · {e.hostName}</span> : null}
                      </div>
                    ))}
                    {dayEvents.length > 3 ? (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSelected(key);
                        }}
                        className="w-full rounded px-1.5 text-left text-[11px] font-semibold text-primary/80 hover:text-primary"
                      >
                        +{dayEvents.length - 3} more
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 border-t border-border/50 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary/60" aria-hidden />
              Confirmed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500/70" aria-hidden />
              Awaiting approval
            </span>
            <span className="ml-auto hidden sm:block">Times in {timeZone.replace(/_/g, " ")}</span>
          </div>
        </div>

        {/* Day detail rail */}
        <aside className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">{selectedLabel ?? "Select a day"}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {selectedEvents.length === 0
                  ? "No meetings"
                  : `${selectedEvents.length} meeting${selectedEvents.length === 1 ? "" : "s"}`}
              </p>
            </div>
            {selected ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 shrink-0 gap-1 px-2 text-xs"
                onClick={() => openCreate(selected)}
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </Button>
            ) : null}
          </div>

          <div className="mt-4 space-y-2">
            {selectedEvents.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-dashed border-border/60 py-10 text-center">
                <CalendarX2 className="h-6 w-6 text-foreground/25" />
                <p className="mt-2 text-xs text-foreground/40">Nothing scheduled.</p>
              </div>
            ) : (
              selectedEvents.map((e) => (
                <Link
                  key={e.uid}
                  href={`/dashboard/bookings/${e.uid}` as Route}
                  className="group block rounded-lg border border-border/50 bg-card p-3 transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight">{e.title}</p>
                    {e.status === "pending" ? (
                      <Badge variant="secondary" className="shrink-0 text-[10px] gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        Pending
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {timeInTz(e.start)} – {timeInTz(e.end)}
                    </span>
                    {e.attendee ? (
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        {e.attendee}
                        {e.hostName ? <span className="text-muted-foreground/70">with {e.hostName}</span> : null}
                      </span>
                    ) : null}
                    {e.location ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {e.location}
                      </span>
                    ) : null}
                  </div>
                  <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Open details <ExternalLink className="h-3 w-3" />
                  </span>
                </Link>
              ))
            )}
          </div>
        </aside>
      </div>

      <QuickBookingDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        date={createDate}
        services={services}
        providers={teamMembers}
      />
    </div>
  );
}
