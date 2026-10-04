"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CalendarDays, Check, ChevronRight, Copy, ExternalLink, Inbox } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { initials } from "@/lib/format";
import { addDaysToKey, formatDateKey } from "@/lib/time";
import { cn } from "@/lib/utils";

interface OverviewEvent {
  uid: string;
  title: string;
  startTime: string;
  endTime: string;
  attendeeName: string | null;
  /** set only in team-wide views so owners can tell whose meeting it is */
  hostName: string | null;
  location: string | null;
}

export interface OverviewData {
  upcoming: number;
  pending: number;
  /** true total for today; the list below may be capped */
  todayCount: number;
  today: OverviewEvent[];
  thisWeek: OverviewEvent[];
  /** first booking beyond this week, for the quiet-week hint */
  nextUpcoming: OverviewEvent | null;
}

interface DaySection {
  key: string;
  /** "Today", "Tomorrow" or "Next up" in front of the date */
  lead: string | null;
  date: string;
  note: string | null;
  events: OverviewEvent[];
}

export function DashboardOverview({
  todayKey,
  timeZone,
  hour12,
  locale,
  bookingUrl,
  data,
}: {
  /** "YYYY-MM-DD" in the viewer's zone, from the server so hydration agrees */
  todayKey: string;
  timeZone: string;
  hour12: boolean;
  locale: string;
  bookingUrl: string | null;
  data: OverviewData;
}) {
  const [copied, setCopied] = useState(false);

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", hour12, timeZone });
  }

  function formatDay(iso: string): string {
    return new Date(iso).toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric", timeZone });
  }

  async function copyLink() {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  const tomorrowKey = addDaysToKey(todayKey, 1);
  const sections: DaySection[] = [];
  if (data.today.length > 0) {
    sections.push({
      key: todayKey,
      lead: "Today",
      date: formatDay(data.today[0].startTime),
      note: data.todayCount > data.today.length ? `Showing ${data.today.length} of ${data.todayCount}` : null,
      events: data.today,
    });
  }
  for (const event of data.thisWeek) {
    const key = formatDateKey(new Date(event.startTime), timeZone);
    const last = sections[sections.length - 1];
    if (last && last.key === key) {
      last.events.push(event);
      continue;
    }
    sections.push({
      key,
      lead: key === tomorrowKey ? "Tomorrow" : null,
      date: formatDay(event.startTime),
      note: null,
      events: [event],
    });
  }
  const quiet = sections.length === 0;
  if (quiet && data.nextUpcoming) {
    sections.push({
      key: "next",
      lead: "Next up",
      date: formatDay(data.nextUpcoming.startTime),
      note: null,
      events: [data.nextUpcoming],
    });
  }
  const showProvider = sections.some((section) => section.events.some((event) => event.hostName !== null));

  const stats = [
    { label: "Today", value: data.todayCount, href: "/dashboard/calendar", attention: false },
    { label: "Upcoming", value: data.upcoming, href: "/dashboard/bookings?tab=upcoming", attention: false },
    { label: "Pending", value: data.pending, href: "/dashboard/bookings?tab=pending", attention: data.pending > 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href as Route}
            className="rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-ring/25"
          >
            <Card className="h-full p-4 transition-colors hover:bg-muted/40 sm:p-5">
              <p className="flex items-center gap-1.5 text-meta text-muted-foreground">
                {stat.attention ? <span className="size-1.5 rounded-full bg-warning" aria-hidden /> : null}
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {stat.value}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <div className={cn("grid gap-6", bookingUrl && "lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start")}>
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Schedule</CardTitle>
              <CardDescription>Confirmed bookings over the next 7 days.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="-mr-2">
              <Link href="/dashboard/bookings">View all</Link>
            </Button>
          </CardHeader>

          {sections.length > 0 ? (
            <div className="divide-y border-t">
              {quiet ? (
                <p className="px-4 py-3 text-meta text-muted-foreground sm:px-5">
                  Nothing scheduled in the next 7 days.
                </p>
              ) : null}
              {sections.map((section) => (
                <section key={section.key} aria-labelledby={`overview-${section.key}`}>
                  <h3
                    id={`overview-${section.key}`}
                    className="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2 text-meta font-medium text-muted-foreground sm:px-5"
                  >
                    {section.lead ? (
                      <>
                        <span className="text-foreground">{section.lead}</span>
                        <span aria-hidden>·</span>
                      </>
                    ) : null}
                    <span className="truncate">{section.date}</span>
                    {section.note ? <span className="ml-auto shrink-0 font-normal">{section.note}</span> : null}
                  </h3>
                  <div className="divide-y">
                    {section.events.map((event) => (
                      <EventRow
                        key={event.uid}
                        event={event}
                        formatTime={formatTime}
                        showProvider={showProvider}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : data.pending > 0 ? (
            <EmptyState
              bare
              icon={Inbox}
              title="Nothing confirmed yet"
              description={`${data.pending} booking request${data.pending === 1 ? " is" : "s are"} waiting for your decision.`}
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/bookings?tab=pending">Review requests</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              bare
              icon={CalendarDays}
              title="No upcoming bookings"
              description="Share your booking page to start receiving meetings."
            />
          )}
        </Card>

        {bookingUrl ? (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Booking page</CardTitle>
              <CardDescription>Share this link so customers can book a time.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex h-9 items-center rounded-lg border bg-muted/40 px-3" title={bookingUrl}>
                <span className="truncate text-meta text-foreground">
                  {bookingUrl.replace(/^https?:\/\//, "")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" size="sm" onClick={copyLink}>
                  {copied ? <Check className="text-success" /> : <Copy />}
                  {copied ? "Copied" : "Copy link"}
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink />
                    Open page
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function EventRow({
  event,
  formatTime,
  showProvider,
}: {
  event: OverviewEvent;
  formatTime: (iso: string) => string;
  showProvider: boolean;
}) {
  return (
    <Link
      href={`/dashboard/bookings/${event.uid}` as Route}
      className="flex items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 sm:px-5"
    >
      <div className="w-20 shrink-0 whitespace-nowrap tabular-nums">
        <p className="text-sm font-medium text-foreground">{formatTime(event.startTime)}</p>
        <p className="text-meta text-muted-foreground">{formatTime(event.endTime)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
        <p className="truncate text-meta text-muted-foreground">
          {event.attendeeName ?? "No attendee"}
          {event.location ? <span className="max-sm:hidden"> · {event.location}</span> : null}
          {event.hostName ? <span className="md:hidden"> · with {event.hostName}</span> : null}
        </p>
      </div>
      {showProvider ? (
        <div className="hidden w-36 shrink-0 items-center gap-2 md:flex">
          {event.hostName ? (
            <>
              <Avatar className="h-6 w-6">
                <AvatarFallback>{initials(event.hostName)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-meta text-muted-foreground">{event.hostName}</span>
            </>
          ) : (
            <span className="text-meta text-muted-foreground">Unassigned</span>
          )}
        </div>
      ) : null}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />
    </Link>
  );
}
