"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  Server,
  Unplug,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

type EmailProvider = "smtp" | "microsoft365";

interface EmailSettingsResponse {
  provider: EmailProvider;
  callbackUrl: string;
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: "";
    from: string;
    passwordConfigured: boolean;
  } | null;
  microsoft: {
    tenantId: string;
    clientId: string;
    clientSecret: "";
    fromName: string;
    secretConfigured: boolean;
  } | null;
  microsoftConnection: {
    connected: boolean;
    account: {
      email: string;
      name: string;
      tenantId?: string;
    } | null;
  };
}

const emptySmtp = { host: "", port: "587", user: "", pass: "", from: "" };
const emptyMicrosoft = {
  tenantId: "",
  clientId: "",
  clientSecret: "",
  fromName: "Tidetime",
};

function TestResult({
  provider,
  result,
}: {
  provider: EmailProvider;
  result: { provider: EmailProvider; ok: boolean; message: string } | null;
}) {
  if (!result || result.provider !== provider) return null;
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
      result.ok
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        : "bg-destructive/10 text-destructive"
    }`}>
      {result.ok
        ? <CheckCircle2 className="h-4 w-4" />
        : <XCircle className="h-4 w-4" />}
      {result.message}
    </div>
  );
}

export function EmailSettings() {
  const { toast } = useToast();
  const [loaded, setLoaded] = useState(false);
  const [activeProvider, setActiveProvider] = useState<EmailProvider>("smtp");
  const [tab, setTab] = useState<EmailProvider>("smtp");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [smtp, setSmtp] = useState(emptySmtp);
  const [smtpPasswordConfigured, setSmtpPasswordConfigured] = useState(false);
  const [microsoft, setMicrosoft] = useState(emptyMicrosoft);
  const [configuredMicrosoftApp, setConfiguredMicrosoftApp] =
    useState<{ tenantId: string; clientId: string } | null>(null);
  const [microsoftSecretConfigured, setMicrosoftSecretConfigured] = useState(false);
  const [microsoftConnection, setMicrosoftConnection] =
    useState<EmailSettingsResponse["microsoftConnection"]>({
      connected: false,
      account: null,
    });
  const [testing, setTesting] = useState<EmailProvider | null>(null);
  const [testResult, setTestResult] =
    useState<{ provider: EmailProvider; ok: boolean; message: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const response = await fetch("/api/settings?key=email", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load email settings");
    const data = await response.json() as EmailSettingsResponse;
    setActiveProvider(data.provider);
    setTab(data.provider);
    setCallbackUrl(data.callbackUrl);
    if (data.smtp) {
      setSmtp({
        host: data.smtp.host || "",
        port: String(data.smtp.port || 587),
        user: data.smtp.user || "",
        pass: "",
        from: data.smtp.from || "",
      });
      setSmtpPasswordConfigured(data.smtp.passwordConfigured);
    }
    if (data.microsoft) {
      setMicrosoft({
        tenantId: data.microsoft.tenantId || "",
        clientId: data.microsoft.clientId || "",
        clientSecret: "",
        fromName: data.microsoft.fromName || "Tidetime",
      });
      setConfiguredMicrosoftApp({
        tenantId: data.microsoft.tenantId || "",
        clientId: data.microsoft.clientId || "",
      });
      setMicrosoftSecretConfigured(data.microsoft.secretConfigured);
    }
    setMicrosoftConnection(data.microsoftConnection);
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .catch((error) => {
        if (!cancelled) {
          toast({
            title: "Couldn’t load email settings",
            description: error instanceof Error ? error.message : "Please refresh the page.",
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    const params = new URLSearchParams(window.location.search);
    if (params.get("microsoft_connected") === "1") {
      toast({
        title: "Microsoft 365 connected",
        description: "You can now test it and choose it as the active email provider.",
      });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("microsoft_error")) {
      toast({
        title: "Microsoft 365 connection failed",
        description: params.get("microsoft_error") || "Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }

    return () => {
      cancelled = true;
    };
  }, [load, toast]);

  async function jsonRequest(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    const response = await fetch(url, init);
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(String(data.error || data.message || "Request failed"));
    return data;
  }

  function saveSmtp() {
    startTransition(async () => {
      try {
        await jsonRequest("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: "smtp",
            config: { ...smtp, port: Number(smtp.port) },
          }),
        });
        setSmtpPasswordConfigured(Boolean(smtp.pass) || smtpPasswordConfigured);
        setSmtp((current) => ({ ...current, pass: "" }));
        toast({ title: "SMTP settings saved" });
      } catch (error) {
        toast({
          title: "Couldn’t save SMTP",
          description: error instanceof Error ? error.message : "Check the settings.",
          variant: "destructive",
        });
      }
    });
  }

  async function saveMicrosoft(): Promise<boolean> {
    try {
      await jsonRequest("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "microsoft365", config: microsoft }),
      });
      const appChanged = Boolean(
        configuredMicrosoftApp &&
        (
          configuredMicrosoftApp.tenantId !== microsoft.tenantId.trim() ||
          configuredMicrosoftApp.clientId !== microsoft.clientId.trim()
        ),
      );
      setMicrosoftSecretConfigured(Boolean(microsoft.clientSecret) || microsoftSecretConfigured);
      setMicrosoft((current) => ({ ...current, clientSecret: "" }));
      setConfiguredMicrosoftApp({
        tenantId: microsoft.tenantId.trim(),
        clientId: microsoft.clientId.trim(),
      });
      if (appChanged) {
        setMicrosoftConnection({ connected: false, account: null });
        if (activeProvider === "microsoft365") setActiveProvider("smtp");
      }
      toast({ title: "Microsoft application settings saved" });
      return true;
    } catch (error) {
      toast({
        title: "Couldn’t save Microsoft settings",
        description: error instanceof Error ? error.message : "Check the application details.",
        variant: "destructive",
      });
      return false;
    }
  }

  function saveMicrosoftOnly() {
    startTransition(async () => {
      await saveMicrosoft();
    });
  }

  function connectMicrosoft() {
    startTransition(async () => {
      setConnecting(true);
      const saved = await saveMicrosoft();
      if (saved) {
        window.location.assign("/api/microsoft-email/auth");
        return;
      }
      setConnecting(false);
    });
  }

  function activate(provider: EmailProvider) {
    startTransition(async () => {
      try {
        await jsonRequest("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "email_provider", config: { provider } }),
        });
        setActiveProvider(provider);
        toast({
          title: provider === "smtp" ? "SMTP is now active" : "Microsoft 365 is now active",
          description: "New outgoing emails will use this connection.",
        });
      } catch (error) {
        toast({
          title: "Couldn’t activate provider",
          description: error instanceof Error ? error.message : "Check the connection first.",
          variant: "destructive",
        });
      }
    });
  }

  async function test(provider: EmailProvider) {
    setTesting(provider);
    setTestResult(null);
    try {
      const body = provider === "smtp"
        ? { provider, config: { ...smtp, port: Number(smtp.port) } }
        : { provider };
      const response = await fetch("/api/settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json() as { ok?: boolean; message?: string };
      setTestResult({
        provider,
        ok: Boolean(data.ok),
        message: data.message || "Test failed",
      });
    } catch {
      setTestResult({ provider, ok: false, message: "Network error — please try again" });
    } finally {
      setTesting(null);
    }
  }

  function disconnectMicrosoft() {
    startTransition(async () => {
      try {
        await jsonRequest("/api/microsoft-email/disconnect", { method: "POST" });
        setMicrosoftConnection({ connected: false, account: null });
        if (activeProvider === "microsoft365") setActiveProvider("smtp");
        toast({ title: "Microsoft 365 disconnected" });
      } catch (error) {
        toast({
          title: "Couldn’t disconnect Microsoft 365",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      }
    });
  }

  async function copyCallback() {
    await navigator.clipboard.writeText(callbackUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (!loaded) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading email delivery settings…</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 lg:col-span-2">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Email delivery</h2>
        <Badge variant="success" className="ml-auto">
          {activeProvider === "smtp" ? "SMTP active" : "Microsoft 365 active"}
        </Badge>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Keep both connections configured and choose which one Tidetime uses for booking
        confirmations, invitations, password resets, and team invitations.
      </p>

      <Tabs value={tab} onValueChange={(value) => setTab(value as EmailProvider)}>
        <TabsList>
          <TabsTrigger value="microsoft365">Microsoft 365</TabsTrigger>
          <TabsTrigger value="smtp">SMTP</TabsTrigger>
        </TabsList>

        <TabsContent value="microsoft365" className="mt-5 space-y-5">
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
            <h3 className="text-sm font-semibold">Before you connect</h3>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>Create a single-tenant Web app registration in Microsoft Entra.</li>
              <li>Add the callback URL below as a Web redirect URI.</li>
              <li>Add delegated Microsoft Graph permissions: Mail.Send and User.Read.</li>
              <li>Create a client secret, paste the details below, then connect the mailbox.</li>
            </ol>
            <a
              href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Open Microsoft Entra app registrations
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="space-y-1.5">
            <Label>
              App Callback URL{" "}
              <InfoTip>Copy this exactly into the app registration&apos;s Web redirect URI.</InfoTip>
            </Label>
            <div className="flex gap-2">
              <Input value={callbackUrl} readOnly className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={copyCallback}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="sr-only">Copy callback URL</span>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Directory Tenant ID{" "}
                <InfoTip>Find this on the app registration Overview page.</InfoTip>
              </Label>
              <Input
                value={microsoft.tenantId}
                onChange={(event) =>
                  setMicrosoft({ ...microsoft, tenantId: event.target.value })}
                placeholder="00000000-0000-0000-0000-000000000000"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Application Client ID</Label>
              <Input
                value={microsoft.clientId}
                onChange={(event) =>
                  setMicrosoft({ ...microsoft, clientId: event.target.value })}
                placeholder="00000000-0000-0000-0000-000000000000"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Application Client Secret</Label>
              <Input
                value={microsoft.clientSecret}
                onChange={(event) =>
                  setMicrosoft({ ...microsoft, clientSecret: event.target.value })}
                type="password"
                placeholder={microsoftSecretConfigured
                  ? "Saved — leave blank to keep it"
                  : "Paste the secret value, not its Secret ID"}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Sender name</Label>
              <Input
                value={microsoft.fromName}
                onChange={(event) =>
                  setMicrosoft({ ...microsoft, fromName: event.target.value })}
                placeholder="Tidetime"
              />
              <p className="text-xs text-muted-foreground">
                The email address comes from the Microsoft mailbox you connect.
              </p>
            </div>
          </div>

          {microsoftConnection.connected && microsoftConnection.account ? (
            <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 sm:flex-row sm:items-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Connected as {microsoftConnection.account.name}
                </p>
                <p className="truncate text-xs text-emerald-700 dark:text-emerald-400">
                  {microsoftConnection.account.email}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={disconnectMicrosoft} loading={pending}>
                <Unplug className="h-4 w-4" />
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              No Microsoft 365 mailbox is connected yet.
            </div>
          )}

          <TestResult provider="microsoft365" result={testResult} />

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={saveMicrosoftOnly} loading={pending}>
              Save app details
            </Button>
            <Button onClick={connectMicrosoft} loading={connecting || pending}>
              {microsoftConnection.connected ? "Reconnect mailbox" : "Connect Microsoft 365"}
            </Button>
            {microsoftConnection.connected ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => test("microsoft365")}
                  loading={testing === "microsoft365"}
                >
                  Send test email
                </Button>
                {activeProvider !== "microsoft365" ? (
                  <Button variant="secondary" onClick={() => activate("microsoft365")} loading={pending}>
                    Use Microsoft 365
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="smtp" className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>SMTP Host</Label>
              <Input
                value={smtp.host}
                onChange={(event) => setSmtp({ ...smtp, host: event.target.value })}
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Port <InfoTip>Common values are 587 for STARTTLS or 465 for implicit TLS.</InfoTip>
              </Label>
              <Input
                value={smtp.port}
                onChange={(event) => setSmtp({ ...smtp, port: event.target.value })}
                inputMode="numeric"
                placeholder="587"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input
                value={smtp.user}
                onChange={(event) => setSmtp({ ...smtp, user: event.target.value })}
                placeholder="user@example.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                value={smtp.pass}
                onChange={(event) => setSmtp({ ...smtp, pass: event.target.value })}
                type="password"
                placeholder={smtpPasswordConfigured
                  ? "Saved — leave blank to keep it"
                  : "SMTP password"}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>
                From address{" "}
                <InfoTip>For example: Tidetime &lt;noreply@example.com&gt;.</InfoTip>
              </Label>
              <Input
                value={smtp.from}
                onChange={(event) => setSmtp({ ...smtp, from: event.target.value })}
                placeholder="Tidetime <noreply@example.com>"
              />
            </div>
          </div>

          <TestResult provider="smtp" result={testResult} />

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveSmtp} loading={pending}>Save SMTP</Button>
            <Button
              variant="outline"
              onClick={() => test("smtp")}
              loading={testing === "smtp"}
            >
              Test connection
            </Button>
            {activeProvider !== "smtp" ? (
              <Button variant="secondary" onClick={() => activate("smtp")} loading={pending}>
                <Server className="h-4 w-4" />
                Use SMTP
              </Button>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
