"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, CalendarRange, CheckCircle2, AlertTriangle } from "lucide-react";

const OAUTH_ERRORS: Record<string, string> = {
  access_denied: "You declined access on the Microsoft consent screen.",
  invalid_state: "The sign-in link expired. Please try connecting again.",
  forbidden: "Your role doesn't allow managing connections.",
};

/**
 * Per-user Microsoft 365 calendar connection: read-only busy-time sync so
 * Outlook events block public availability. Uses the company's Entra app.
 */
export function MicrosoftCalendarSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [expired, setExpired] = useState(false);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    loadStatus();
    const params = new URLSearchParams(window.location.search);
    const error = params.get("ms_calendar_error");
    if (params.get("ms_calendar_connected")) {
      toast({ title: "Microsoft 365 Calendar connected", description: "Outlook busy times now block your public availability." });
    } else if (error) {
      toast({
        variant: "destructive",
        title: "Couldn't connect Microsoft 365 Calendar",
        description: OAUTH_ERRORS[error] ?? error,
      });
    }
    if (params.get("ms_calendar_connected") || error) {
      params.delete("ms_calendar_connected");
      params.delete("ms_calendar_error");
      const qs = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/microsoft-calendar/status");
      if (res.ok) {
        const data = await res.json();
        setConnected(Boolean(data.connected));
        setExpired(Boolean(data.expired));
        setConfigured(Boolean(data.configured));
      }
    } catch {
      /* leave defaults */
    } finally {
      setLoading(false);
    }
  }

  function connect() {
    setConnecting(true);
    setTimeout(() => setConnecting(false), 8000);
    window.location.href = "/api/microsoft-calendar/auth";
  }

  async function disconnect() {
    const res = await fetch("/api/microsoft-calendar/disconnect", { method: "POST" });
    if (res.ok) {
      setConnected(false);
      setExpired(false);
      toast({ title: "Microsoft 365 Calendar disconnected" });
    } else {
      toast({ title: "Couldn't disconnect", description: "Please try again.", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Checking Microsoft 365 Calendar status...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <CalendarRange className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Microsoft 365 Calendar</h2>
        {connected && (
          <Badge variant="success" className="ml-2">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Connected
          </Badge>
        )}
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Read-only busy-time sync: events on your Outlook calendar block your public availability so
        double-bookings can&apos;t happen.
      </p>

      {!configured ? (
        <div className="rounded-lg border border-border/60 bg-secondary/30 p-4 text-sm text-muted-foreground">
          Ask an admin to configure the Microsoft 365 application under Connections → Email delivery
          first — the calendar uses the same app registration.
        </div>
      ) : !connected ? (
        <div className="space-y-4">
          {expired ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Your Microsoft connection expired</p>
                <p className="mt-0.5">Outlook busy times stopped blocking your availability. Reconnect to resume.</p>
              </div>
            </div>
          ) : null}
          <Button onClick={connect} disabled={connecting}>
            {connecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting...
              </>
            ) : expired ? (
              "Reconnect Microsoft 365 Calendar"
            ) : (
              "Connect Microsoft 365 Calendar"
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300">
            <p className="font-medium">Outlook busy times are syncing</p>
            <p className="mt-1 text-emerald-700 dark:text-emerald-400">
              Times you&apos;re busy in Outlook are removed from your public booking page.
            </p>
          </div>
          <div className="flex items-center gap-2 border-t border-border/60 pt-2">
            <Button variant="outline" size="sm" onClick={loadStatus}>
              Refresh
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
                  Disconnect
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Microsoft 365 Calendar?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Outlook events will no longer block your public availability.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={disconnect}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/88"
                  >
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </Card>
  );
}
