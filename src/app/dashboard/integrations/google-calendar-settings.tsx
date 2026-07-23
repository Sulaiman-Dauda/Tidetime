"use client";

import { useEffect, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, CheckCircle2 } from "lucide-react";

interface GoogleCalendarView {
  id: string;
  summary: string;
  primary: boolean;
}

export function GoogleCalendarSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendarView[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [destinationCalendarId, setDestinationCalendarId] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    loadStatus();
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

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Checking Google Calendar status...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Google Calendar</h2>
        {connected && (
          <Badge variant="success" className="ml-2">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Sync your availability with Google Calendar. Tidetime reads your busy time to prevent
        double-bookings and can create calendar events for new appointments.
      </p>

      {!connected ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-4 text-sm text-muted-foreground">
            <p>Connect your Google account to:</p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Automatically block times you&apos;re busy on your Google Calendar</li>
              <li>Have new bookings created as Google Calendar events</li>
              <li>Keep your schedule in sync without manual copying</li>
            </ul>
          </div>
          <Button onClick={connect} disabled={connecting}>
            {connecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Redirecting...
              </>
            ) : (
              "Connect Google Calendar"
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300">
            <p className="font-medium">Google Calendar is connected</p>
            <p className="mt-1 text-emerald-700 dark:text-emerald-400">
              Your busy time is synced and new bookings will appear on your calendar.
            </p>
          </div>

          {calendars.length > 0 && (
            <>
              <div>
                <h3 className="mb-3 text-sm font-semibold">Select calendars to check for conflicts</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  Tidetime will read busy time from selected calendars. Uncheck any you want to ignore.
                </p>
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {calendars.map((cal) => (
                    <label
                      key={cal.id}
                      className="flex cursor-pointer items-center justify-between rounded-md border border-border/60 p-3 text-sm hover:bg-secondary/30"
                    >
                      <div>
                        <span className="font-medium">{cal.summary}</span>
                        {cal.primary && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            Primary
                          </Badge>
                        )}
                      </div>
                      <Switch
                        checked={selected.includes(cal.id)}
                        onCheckedChange={(c) => toggleCalendar(cal.id, c)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold">Where new bookings should be created</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  Choose the Google Calendar that receives new booking events. Leave it on the primary calendar if you do not need a custom destination.
                </p>
                <Select
                  value={destinationCalendarId ?? "primary"}
                  onValueChange={saveDestination}
                >
                  <SelectTrigger className="max-w-md">
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
              </div>
            </>
          )}

          <div className="flex items-center gap-2 border-t border-border/60 pt-2">
            <Button variant="outline" size="sm" onClick={loadStatus}>
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={disconnect}
              className="text-destructive hover:bg-destructive/10"
            >
              Disconnect
            </Button>
            {saving ? <span className="text-xs text-muted-foreground">Saving…</span> : null}
          </div>
        </div>
      )}
    </Card>
  );
}
