"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, Copy, Check, ArrowRight, User, Sparkles } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { NewEventTypeButton } from "./new-event-type-button";
import { InstantMeetingButton } from "./instant-meeting-button";

interface OverviewEvent {
  uid: string;
  title: string;
  startTime: string;
  endTime: string;
  attendeeName: string | null;
}

interface OverviewData {
  upcoming: number;
  pending: number;
  today: OverviewEvent[];
  thisWeek: OverviewEvent[];
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function DashboardOverview({ username, bookingUrl }: { username: string; bookingUrl: string }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/overview")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d) => { if (!cancelled && d) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  }

  const displayUrl = bookingUrl.replace(/^https?:\/\//, "");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {greet()}, {username}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {todayLabel()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InstantMeetingButton />
          <NewEventTypeButton size="sm" />
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Today's bookings */}
        <Link
          href="/dashboard/bookings?tab=upcoming"
          className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calendar className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            {data ? (
              <p className="tabular-stat text-xl font-semibold">{data.today.length}</p>
            ) : (
              <Skeleton className="h-6 w-6" />
            )}
            <p className="text-xs text-muted-foreground">Today</p>
          </div>
        </Link>

        {/* Upcoming count */}
        <Link
          href="/dashboard/calendar"
          className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calendar className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            {data ? (
              <p className="tabular-stat text-xl font-semibold">{data.upcoming}</p>
            ) : (
              <Skeleton className="h-6 w-6" />
            )}
            <p className="text-xs text-muted-foreground">Upcoming</p>
          </div>
        </Link>

        {/* Pending */}
        <Link
          href="/dashboard/bookings?tab=pending"
          className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            {data ? (
              <p className="tabular-stat text-xl font-semibold">{data.pending}</p>
            ) : (
              <Skeleton className="h-6 w-6" />
            )}
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
        </Link>

        {/* Copy link */}
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
      </div>

      {/* Today's events */}
      {data && data.today.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Today</h2>
          <div className="space-y-2">
            {data.today.map((event) => (
              <Link
                key={event.uid}
                href={`/dashboard/bookings/${event.uid}` as Route}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm group"
              >
                <span className="text-sm font-medium tabular-nums w-16 shrink-0 text-muted-foreground">
                  {formatTime(event.startTime)}
                </span>
                <div className="h-8 w-px shrink-0 bg-border/60" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{event.title}</p>
                  {event.attendeeName && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <User className="h-3 w-3" />
                      {event.attendeeName}
                    </p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* This week */}
      {data && data.thisWeek.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">This week</h2>
          <div className="space-y-2">
            {data.thisWeek.map((event) => (
              <Link
                key={event.uid}
                href={`/dashboard/bookings/${event.uid}` as Route}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm group"
              >
                <span className="text-xs font-medium w-24 shrink-0 text-muted-foreground">
                  {formatDay(event.startTime)}
                </span>
                <span className="text-sm font-medium tabular-nums w-16 shrink-0 text-muted-foreground">
                  {formatTime(event.startTime)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{event.title}</p>
                  {event.attendeeName && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <User className="h-3 w-3" />
                      {event.attendeeName}
                    </p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {data && data.today.length === 0 && data.thisWeek.length === 0 && data.pending === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">No bookings yet</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
            Share your booking link or create a service to start receiving meetings.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/30 hover:text-primary"
            >
              <Copy className="h-3 w-3" />
              {copied ? "Copied!" : "Copy link"}
            </button>
            <NewEventTypeButton size="sm" />
          </div>
        </div>
      )}
    </div>
  );
}
