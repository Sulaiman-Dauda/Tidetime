"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, CheckCircle2 } from "lucide-react";

export function CaldavCalendarSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverUrl, setServerUrl] = useState("https://caldav.icloud.com");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/calendar/status");
      if (res.ok) {
        const data = await res.json();
        const cd = (data.connections ?? []).find(
          (c: { integration: string }) => c.integration === "caldav_calendar",
        );
        setConnected(Boolean(cd?.connected));
      }
    } finally {
      setLoading(false);
    }
  }

  async function connect() {
    setBusy(true);
    try {
      const res = await fetch("/api/caldav-calendar/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverUrl, username, password }),
      });
      if (res.ok) {
        setConnected(true);
        setPassword("");
        toast({ title: "Calendar connected" });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Couldn't connect",
          description: data.error ?? "Check the server URL and credentials.",
          variant: "destructive",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    const res = await fetch("/api/caldav-calendar/disconnect", { method: "POST" });
    if (res.ok) {
      setConnected(false);
      toast({ title: "Calendar disconnected" });
    } else {
      toast({ title: "Couldn't disconnect", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Checking calendar status…</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Apple iCloud / CalDAV</h2>
        {connected && (
          <Badge variant="success" className="ml-2">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Connected
          </Badge>
        )}
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Connect Apple iCloud, Fastmail, Nextcloud, or any CalDAV server. For iCloud, use your Apple
        ID and an{" "}
        <a
          href="https://support.apple.com/en-us/102654"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          app-specific password
        </a>
        .
      </p>

      {connected ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300">
            <p className="font-medium">CalDAV calendar is connected</p>
            <p className="mt-1 text-emerald-700 dark:text-emerald-400">
              Busy time is synced and new bookings are written to your calendar.
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
      ) : (
        <div className="max-w-md space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="caldav-url">Server URL</Label>
            <Input
              id="caldav-url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://caldav.icloud.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="caldav-user">Username / Apple ID</Label>
            <Input
              id="caldav-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="you@icloud.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="caldav-pass">Password (app-specific for iCloud)</Label>
            <Input
              id="caldav-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button onClick={connect} disabled={busy || !serverUrl || !username || !password}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting…
              </>
            ) : (
              "Connect calendar"
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}
