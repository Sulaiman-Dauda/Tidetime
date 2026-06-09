"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, CheckCircle2 } from "lucide-react";

export function MicrosoftCalendarSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/calendar/status");
      if (res.ok) {
        const data = await res.json();
        setConfigured(Boolean(data.microsoftConfigured));
        const ms = (data.connections ?? []).find(
          (c: { integration: string }) => c.integration === "office365_calendar",
        );
        setConnected(Boolean(ms?.connected));
      }
    } finally {
      setLoading(false);
    }
  }

  function connect() {
    setConnecting(true);
    window.location.href = "/api/microsoft-calendar/auth";
  }

  async function disconnect() {
    const res = await fetch("/api/microsoft-calendar/disconnect", { method: "POST" });
    if (res.ok) {
      setConnected(false);
      toast({ title: "Microsoft 365 disconnected" });
    } else {
      toast({ title: "Couldn't disconnect", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Checking Microsoft 365 status…</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Microsoft 365 / Outlook</h2>
        {connected && (
          <Badge variant="success" className="ml-2">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Connected
          </Badge>
        )}
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Sync Outlook / Microsoft 365 busy time to prevent double-bookings, and create Outlook events
        (with Teams links) for new appointments.
      </p>

      {!configured ? (
        <div className="rounded-lg border border-border/60 bg-secondary/30 p-4 text-sm text-muted-foreground">
          Microsoft 365 isn&apos;t configured on this instance. Set{" "}
          <code className="font-mono">MICROSOFT_CLIENT_ID</code> and{" "}
          <code className="font-mono">MICROSOFT_CLIENT_SECRET</code> to enable it.
        </div>
      ) : !connected ? (
        <Button onClick={connect} disabled={connecting}>
          {connecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Redirecting…
            </>
          ) : (
            "Connect Microsoft 365"
          )}
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300">
            <p className="font-medium">Microsoft 365 is connected</p>
            <p className="mt-1 text-emerald-700 dark:text-emerald-400">
              Busy time is synced and new bookings appear on your Outlook calendar.
            </p>
          </div>
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
          </div>
        </div>
      )}
    </Card>
  );
}
