"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft, ChevronRight, Clock, MapPin, User, CalendarX2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WEEKDAY_SHORT } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface CalendarEvent {
  uid: string;
  title: string;
  start: string;
  end: string;
  status: "accepted" | "pending";
  location: string | null;
  attendee: string | null;
}

interface Props {
  year: number;
  month: number;
  events: CalendarEvent[];
  timeZone: string;
}

/** YYYY-MM-DD for an instant rendered in a specific timezone (en-CA → ISO order). */
function dayKeyInTz(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function timeInTz(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function monthMatrix(year: number, month: number): (Date | null)[][] {
  const startDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarView({ year, month, events, timeZone }: Props) {
  const rows = useMemo(() => monthMatrix(year, month), [year, month]);

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

  const todayKey = localDayKey(new Date());
  const [selected, setSelected] = useState<string | null>(todayKey);

  const prev = month === 0 ? monthKey(year - 1, 11) : monthKey(year, month - 1);
  const next = month === 11 ? monthKey(year + 1, 0) : monthKey(year, month + 1);
  const thisMonth = monthKey(new Date().getFullYear(), new Date().getMonth());

  const monthLabel = new Date(year, month, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  const selectedEvents = selected ? byDay.get(selected) ?? [] : [];
  const selectedLabel = selected
    ? new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, {
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
            A month-at-a-glance view of every scheduled meeting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/calendar?month=${thisMonth}` as Route}>Today</Link>
          </Button>
          <div className="flex items-center rounded-lg border bg-card shadow-sm">
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

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Month grid */}
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
            {WEEKDAY_SHORT.map((d) => (
              <div key={d} className="py-2.5">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {rows.flat().map((date, i) => {
              if (!date) return <div key={i} className="min-h-[104px] border-b border-r bg-muted/20" />;
              const key = localDayKey(date);
              const dayEvents = byDay.get(key) ?? [];
              const isToday = key === todayKey;
              const isSelected = key === selected;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(key)}
                  className={cn(
                    "group min-h-[104px] border-b border-r p-1.5 text-left align-top transition-colors last:border-r-0 hover:bg-accent/40",
                    isSelected && "bg-accent/60",
                    (i + 1) % 7 === 0 && "border-r-0",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      isToday
                        ? "bg-brand text-brand-foreground shadow-brand"
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    {date.getDate()}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 3).map((e) => (
                      <div
                        key={e.uid}
                        className={cn(
                          "truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight",
                          e.status === "pending"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                            : "bg-brand/10 text-brand dark:text-brand",
                        )}
                        title={e.title}
                      >
                        <span className="tabular-nums opacity-70">{timeInTz(e.start, timeZone)}</span>{" "}
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 ? (
                      <div className="px-1.5 text-[11px] font-medium text-muted-foreground">
                        +{dayEvents.length - 3} more
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail rail */}
        <aside className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">{selectedLabel ?? "Select a day"}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {selectedEvents.length === 0
              ? "No meetings"
              : `${selectedEvents.length} meeting${selectedEvents.length === 1 ? "" : "s"}`}
          </p>

          <div className="mt-4 space-y-2">
            {selectedEvents.length === 0 ? (
              <div className="flex flex-col items-center rounded-lg border border-dashed border-border py-10 text-center">
                <CalendarX2 className="h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-xs text-muted-foreground">Nothing scheduled.</p>
              </div>
            ) : (
              selectedEvents.map((e) => (
                <Link
                  key={e.uid}
                  href={`/booking/${e.uid}` as Route}
                  className="group block rounded-md border border-border bg-background p-3 transition-colors hover:border-brand/30 hover:bg-accent/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight">{e.title}</p>
                    {e.status === "pending" ? (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        Pending
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {timeInTz(e.start, timeZone)} – {timeInTz(e.end, timeZone)}
                    </span>
                    {e.attendee ? (
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        {e.attendee}
                      </span>
                    ) : null}
                    {e.location ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {e.location}
                      </span>
                    ) : null}
                  </div>
                  <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
                    Open booking <ExternalLink className="h-3 w-3" />
                  </span>
                </Link>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
