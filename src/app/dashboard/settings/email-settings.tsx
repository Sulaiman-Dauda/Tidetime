"use client";

import { useState, useEffect, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, CheckCircle2, XCircle } from "lucide-react";

export function EmailSettings() {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [form, setForm] = useState({ host: "", port: "587", user: "", pass: "", from: "" });
  const [loaded, setLoaded] = useState(false);
  const [pending, start] = useTransition();

  // Load current config on mount
  useEffect(() => {
    let cancelled = false;
    start(async () => {
      const res = await fetch("/api/settings?key=smtp");
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setForm({
            host: data.config.host || "",
            port: String(data.config.port || 587),
            user: data.config.user || "",
            pass: data.config.pass || "",
            from: data.config.from || "",
          });
        }
      }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  if (!loaded) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading email settings...</p>
        </div>
      </Card>
    );
  }

  function save() {
    start(async () => {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "smtp", config: { ...form, port: Number(form.port) } }),
      });
      if (res.ok) {
        toast({ title: "Email settings saved" });
      } else {
        const err = await res.json();
        toast({ title: err.error || "Failed to save", variant: "destructive" });
      }
    });
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: { ...form, port: Number(form.port) } }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, message: "Network error — check your SMTP host and port" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Email (SMTP)</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Configure outgoing email for invites, booking confirmations, and reminders.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>SMTP Host</Label>
          <Input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="smtp.example.com" />
        </div>
        <div className="space-y-1.5">
          <Label>Port</Label>
          <Input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder="587" />
        </div>
        <div className="space-y-1.5">
          <Label>Username</Label>
          <Input value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} placeholder="user@example.com" autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label>Password</Label>
          <Input value={form.pass} onChange={(e) => setForm({ ...form, pass: e.target.value })} type="password" placeholder="••••••••" autoComplete="off" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>From address</Label>
          <Input value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} placeholder="Tidetime <noreply@example.com>" />
        </div>
      </div>

      {testResult && (
        <div className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
          testResult.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive"
        }`}>
          {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {testResult.message}
        </div>
      )}

      <div className="mt-5 flex items-center gap-2">
        <Button onClick={save} loading={pending}>Save</Button>
        <Button variant="outline" onClick={test} loading={testing}>Test connection</Button>
      </div>
    </Card>
  );
}
