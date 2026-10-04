"use client";

import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { CalendarRange } from "lucide-react";
import { ConnectionBody, ConnectionCard, ConnectionFooter, ConnectionNotice } from "./connection-card";

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

  const status = loading ? (
    <Skeleton className="h-5 w-24 rounded-full" />
  ) : !configured ? (
    <Badge variant="outline">Not set up</Badge>
  ) : connected ? (
    <Badge variant="success" dot>Connected</Badge>
  ) : expired ? (
    <Badge variant="warning" dot>Expired</Badge>
  ) : (
    <Badge variant="outline">Not connected</Badge>
  );

  return (
    <ConnectionCard
      icon={CalendarRange}
      title="Microsoft 365 Calendar"
      description="Read-only busy-time sync. Events on your Outlook calendar block your public availability, so double bookings can't happen."
      status={status}
    >
      {loading ? (
        <ConnectionBody>
          <Skeleton className="h-4 w-2/3" />
        </ConnectionBody>
      ) : !configured ? (
        <ConnectionBody>
          <p className="text-sm text-muted-foreground">
            Ask an admin to set up the Microsoft 365 app under Email delivery first. The calendar
            uses the same app registration.
          </p>
        </ConnectionBody>
      ) : !connected ? (
        <>
          {expired ? (
            <ConnectionBody>
              <ConnectionNotice tone="warning" title="Your Microsoft connection expired">
                Outlook busy times stopped blocking your availability. Reconnect to resume.
              </ConnectionNotice>
            </ConnectionBody>
          ) : null}
          <ConnectionFooter>
            <Button onClick={connect} loading={connecting}>
              {connecting
                ? "Redirecting…"
                : expired
                  ? "Reconnect Microsoft 365 Calendar"
                  : "Connect Microsoft 365 Calendar"}
            </Button>
          </ConnectionFooter>
        </>
      ) : (
        <>
          <ConnectionBody>
            <p className="text-sm text-muted-foreground">
              Times you&apos;re busy in Outlook are removed from your public booking page.
            </p>
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
                  <AlertDialogTitle>Disconnect Microsoft 365 Calendar?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Outlook events will no longer block your public availability.
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
            <Button variant="outline" onClick={loadStatus}>
              Refresh
            </Button>
          </ConnectionFooter>
        </>
      )}
    </ConnectionCard>
  );
}
