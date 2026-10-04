"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Calendar } from "lucide-react";
import { ConnectionBody, ConnectionCard, ConnectionFooter, ConnectionNotice } from "./connection-card";

interface GoogleCalendarView {
  id: string;
  summary: string;
  primary: boolean;
}

const OAUTH_ERRORS: Record<string, string> = {
  access_denied: "You declined access on the Google consent screen.",
  invalid_state: "The sign-in link expired. Please try connecting again.",
  forbidden: "Your role doesn't allow managing connections.",
};

export function GoogleCalendarSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [expired, setExpired] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendarView[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [destinationCalendarId, setDestinationCalendarId] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    loadStatus();
    // Surface the OAuth outcome the callback redirect put in the URL: a
    // failed connect must never be silent.
    const params = new URLSearchParams(window.location.search);
    const googleError = params.get("google_error") ?? params.get("app_error");
    if (params.get("google_connected")) {
      toast({ title: "Google Calendar connected", description: "Busy times will now block your public availability." });
    } else if (googleError) {
      toast({
        variant: "destructive",
        title: "Couldn't connect Google Calendar",
        description: OAUTH_ERRORS[googleError] ?? googleError,
      });
    }
    if (params.get("google_connected") || googleError) {
      params.delete("google_connected");
      params.delete("google_error");
      params.delete("app_error");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/google-calendar/calendars");
      if (res.ok) {
        const data = await res.json();
        setCalendars(data.calendars ?? []);
        setSelected(data.selected ?? []);
        setDestinationCalendarId(data.destinationCalendarId ?? null);
        setConnected(Boolean(data.connected));
        setExpired(Boolean(data.expired));
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  function connect() {
    setConnecting(true);
    // If the redirect fails (or the user navigates back), don't leave the
    // button stuck on "Redirecting…" forever.
    setTimeout(() => setConnecting(false), 8000);
    window.location.href = "/api/google-calendar/auth";
  }

  async function disconnect() {
    const res = await fetch("/api/google-calendar/disconnect", { method: "POST" });
    if (res.ok) {
      setConnected(false);
      setCalendars([]);
      setSelected([]);
      setDestinationCalendarId(null);
      toast({ title: "Google Calendar disconnected" });
    } else {
      toast({
        title: "Couldn't disconnect Google Calendar",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  }

  function toggleCalendar(id: string, checked: boolean) {
    const next = checked ? [...selected, id] : selected.filter((s) => s !== id);
    setSelected(next);
    startSaving(async () => {
      const res = await fetch("/api/google-calendar/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarIds: next }),
      });
      if (!res.ok) {
        toast({
          title: "Couldn't save calendars",
          description: "Please try again.",
          variant: "destructive",
        });
        await loadStatus();
      }
    });
  }

  function saveDestination(next: string) {
    const calendarId = next === "primary" ? null : next;
    setDestinationCalendarId(calendarId);
    startSaving(async () => {
      const res = await fetch("/api/google-calendar/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationCalendarId: calendarId }),
      });
      if (!res.ok) {
        toast({
          title: "Couldn't save destination calendar",
          description: "Please try again.",
          variant: "destructive",
        });
        await loadStatus();
      }
    });
  }

  const status = loading ? (
    <Skeleton className="h-5 w-24 rounded-full" />
  ) : connected ? (
    <Badge variant="success" dot>Connected</Badge>
  ) : expired ? (
    <Badge variant="warning" dot>Expired</Badge>
  ) : (
    <Badge variant="outline">Not connected</Badge>
  );

  return (
    <ConnectionCard
      icon={Calendar}
      title="Google Calendar"
      description="Busy times on your Google Calendar block your public availability, and new bookings are added as events."
      status={status}
    >
      {loading ? (
        <ConnectionBody>
          <Skeleton className="h-4 w-2/3" />
        </ConnectionBody>
      ) : !connected ? (
        <>
          {expired ? (
            <ConnectionBody>
              <ConnectionNotice tone="warning" title="Your Google connection expired">
                Busy-time conflict checking and calendar events have stopped. Reconnect to resume
                syncing.
              </ConnectionNotice>
            </ConnectionBody>
          ) : null}
          <ConnectionFooter>
            <Button onClick={connect} loading={connecting}>
              {connecting
                ? "Redirecting…"
                : expired
                  ? "Reconnect Google Calendar"
                  : "Connect Google Calendar"}
            </Button>
          </ConnectionFooter>
        </>
      ) : (
        <>
          <ConnectionBody>
            {calendars.length > 0 ? (
              <>
                <div className="space-y-3">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-medium text-foreground">Check these calendars for conflicts</h3>
                    <p className="text-meta text-muted-foreground">
                      Tidetime reads busy time from the calendars switched on here.
                    </p>
                  </div>
                  <div className="max-h-60 divide-y overflow-y-auto rounded-lg border">
                    {calendars.map((cal) => (
                      <label
                        key={cal.id}
                        className="flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-muted/50"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm text-foreground">{cal.summary}</span>
                          {cal.primary ? <Badge variant="secondary">Primary</Badge> : null}
                        </span>
                        <Switch
                          checked={selected.includes(cal.id)}
                          onCheckedChange={(c) => toggleCalendar(cal.id, c)}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <Field
                  label="Add new bookings to"
                  hint="The calendar that receives new booking events. Leave it on the primary calendar unless you need another."
                >
                  <Select
                    value={destinationCalendarId ?? "primary"}
                    onValueChange={saveDestination}
                  >
                    <SelectTrigger aria-label="Add new bookings to">
                      <SelectValue placeholder="Primary calendar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary calendar</SelectItem>
                      {calendars.map((cal) => (
                        <SelectItem key={cal.id} value={cal.id}>
                          {cal.summary}
                          {cal.primary ? " (Primary)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your busy time is synced and new bookings will appear on your calendar.
              </p>
            )}
          </ConnectionBody>
          <ConnectionFooter>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="mr-auto text-destructive hover:bg-destructive-subtle hover:text-destructive">
                  Disconnect
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Busy-time conflict checking stops and new bookings will no longer be added to
                    your Google Calendar. Your selected-calendar choices are removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={disconnect}
                    className={buttonVariants({ variant: "destructive" })}
                  >
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {saving ? <span className="text-meta text-muted-foreground">Saving…</span> : null}
            <Button variant="outline" onClick={loadStatus}>
              Refresh
            </Button>
          </ConnectionFooter>
        </>
      )}
    </ConnectionCard>
  );
}
