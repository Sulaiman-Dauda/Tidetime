"use client";

import { useState, useEffect, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, CheckCircle2, XCircle } from "lucide-react";

export function PaymentSettings() {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [form, setForm] = useState({ publishableKey: "", secretKey: "", webhookSecret: "" });
  const [loaded, setLoaded] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    start(async () => {
      const res = await fetch("/api/settings?key=stripe");
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setForm({
            publishableKey: data.config.publishableKey || "",
            secretKey: data.config.secretKey || "",
            webhookSecret: data.config.webhookSecret || "",
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
          <p className="text-sm text-muted-foreground">Loading payment settings...</p>
        </div>
      </Card>
    );
  }

  function save() {
    start(async () => {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "stripe", config: form }),
      });
      if (res.ok) {
        toast({ title: "Changes saved", description: "Your payment settings have been updated." });
      } else {
        const err = await res.json();
        toast({
          title: "Couldn't save changes",
          description: err.error || "Please check your details and try again.",
          variant: "destructive",
        });
      }
    });
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/test-stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey: form.secretKey }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, message: "Network error — could not reach Stripe" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <CreditCard className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Payments (Stripe)</h2>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Store your Stripe publishable key, secret key, and webhook secret. Attendee checkout is live for paid services. Secret values are encrypted at rest.
      </p>

      <div className="grid gap-4">
        <div className="space-y-1.5">
          <Label>Publishable key</Label>
          <Input
            value={form.publishableKey}
            onChange={(e) => setForm({ ...form, publishableKey: e.target.value })}
            placeholder="pk_live_••••••••••••••••••••"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">Starts with pk_live_ or pk_test_</p>
        </div>
        <div className="space-y-1.5">
          <Label>Secret key</Label>
          <Input
            value={form.secretKey}
            onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
            type="password"
            placeholder="sk_live_••••••••••••••••••••"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Starts with sk_live_ or sk_test_. Leave the masked value unchanged to keep the current key.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Webhook secret</Label>
          <Input
            value={form.webhookSecret}
            onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
            type="password"
            placeholder="whsec_••••••••••••••••••••"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Starts with whsec_. Leave the masked value unchanged to keep the current secret.
          </p>
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
        <Button variant="outline" onClick={test} loading={testing}>Test secret key</Button>
      </div>
    </Card>
  );
}
