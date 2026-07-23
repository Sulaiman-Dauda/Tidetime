"use client";

import { useState } from "react";
import { Calendar, Clock, Copy, Check, ArrowRight, User, UserRound, Sparkles, MapPin, Video } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";
import { NewServiceButton } from "./new-service-button";
import { CountUp } from "./count-up";

interface OverviewEvent {
  uid: string;
  title: string;
  startTime: string;
  endTime: string;
  attendeeName: string | null;
  /** set only in team-wide views so owners can tell whose meeting it is */
  hostName: string | null;
  location: string | null;
  meetingUrl: string | null;
}

export interface OverviewData {
  upcoming: number;
  pending: number;
  /** true total for today — the list below may be capped */
  todayCount: number;
  today: OverviewEvent[];
  thisWeek: OverviewEvent[];
  /** first booking beyond this week, for the quiet-week hint */
  nextUpcoming: OverviewEvent | null;
}

export function DashboardOverview({
  greeting,
  todayLabel,
  timeZone,
  hour12,
  bookingUrl,
  data,
}: {
  greeting: string;
  todayLabel: string;
  timeZone: string;
  hour12: boolean;
  bookingUrl: string | null;
  data: OverviewData;
}) {
  const [copied, setCopied] = useState(false);

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12,
      timeZone,
    });
  }

  function formatDay(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone,
    });
  }

  async function copyLink() {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  }

  const displayUrl = bookingUrl?.replace(/^https?:\/\//, "") ?? "";
  const quiet = data.today.length === 0 && data.thisWeek.length === 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{greeting}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{todayLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <NewServiceButton size="sm" />
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/dashboard/calendar"
          className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calendar className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="tabular-stat text-xl font-semibold"><CountUp value={data.todayCount} /></p>
            <p className="text-xs text-muted-foreground">Today</p>
          </div>
        </Link>

        <Link
          href="/dashboard/bookings?tab=upcoming"
          className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Clock className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="tabular-stat text-xl font-semibold"><CountUp value={data.upcoming} /></p>
            <p className="text-xs text-muted-foreground">Upcoming</p>
          </div>
        </Link>

        <Link
          href="/dashboard/bookings?tab=pending"
          className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <UserRound className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="tabular-stat text-xl font-semibold"><CountUp value={data.pending} /></p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
        </Link>

        {bookingUrl ? (
          <button
            onClick={copyLink}
            className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-sm"
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                copied ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
              )}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{copied ? "Copied!" : "Share link"}</p>
              <p className="truncate text-xs text-muted-foreground font-mono">{displayUrl}</p>
            </div>
          </button>
        ) : null}
      </div>

      {/* Today's events */}
      {data.today.length > 0 && (
        <EventList
          heading={data.todayCount > data.today.length ? `Today · showing ${data.today.length} of ${data.todayCount}` : "Today"}
          events={data.today}
          formatTime={formatTime}
        />
      )}

      {/* This week */}
      {data.thisWeek.length > 0 && (
        <EventList
          heading="This week"
          events={data.thisWeek}
          formatTime={formatTime}
          formatDay={formatDay}
        />
      )}

      {/* Quiet week with something further out */}
      {quiet && data.nextUpcoming && (
        <Link
          href={`/dashboard/bookings/${data.nextUpcoming.uid}` as Route}
          className="group flex items-center gap-3 rounded-2xl border border-dashed border-border/60 p-4 transition-all hover:border-primary/30"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calendar className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Nothing scheduled this week</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Next up: {data.nextUpcoming.title} · {formatDay(data.nextUpcoming.startTime)} at{" "}
              {formatTime(data.nextUpcoming.startTime)}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      )}

      {/* Empty state — genuinely nothing on the books */}
      {quiet && !data.nextUpcoming && data.pending === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">No bookings yet</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
            Share your booking link or create a service to start receiving meetings.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {bookingUrl ? (
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/30 hover:text-primary"
              >
                <Copy className="h-3 w-3" />
                {copied ? "Copied!" : "Copy link"}
              </button>
            ) : null}
            <NewServiceButton size="sm" />
          </div>
        </div>
      )}
    </div>
  );
}

function EventList({
  heading,
  events,
  formatTime,
  formatDay,
}: {
  heading: string;
  events: OverviewEvent[];
  formatTime: (iso: string) => string;
  formatDay?: (iso: string) => string;
}) {
  return (
    <div>
      <h2 className="mb-3 text-base font-semibold tracking-tight text-foreground">{heading}</h2>
      <div className="space-y-2">
        {events.map((event) => (
          <Link
            key={event.uid}
            href={`/dashboard/bookings/${event.uid}` as Route}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm group"
          >
            {formatDay ? (
              <span className="text-xs font-medium w-24 shrink-0 text-muted-foreground">
                {formatDay(event.startTime)}
              </span>
            ) : null}
            <span className="text-sm font-medium tabular-nums w-16 shrink-0 text-muted-foreground">
              {formatTime(event.startTime)}
            </span>
            <div className="h-8 w-px shrink-0 bg-border/60" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {event.title}
                {event.hostName ? (
                  <span className="font-normal text-muted-foreground"> · {event.hostName}</span>
                ) : null}
              </p>
              <p className="mt-0.5 flex items-center gap-2.5 text-xs text-muted-foreground">
                {event.attendeeName && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {event.attendeeName}
                  </span>
                )}
                {event.location && (
                  <span className="flex min-w-0 items-center gap-1">
                    {event.meetingUrl ? <Video className="h-3 w-3 shrink-0" /> : <MapPin className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{event.location}</span>
                  </span>
                )}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </div>
  );
}
