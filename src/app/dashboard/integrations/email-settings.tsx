"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Mail,
  Server,
  Unplug,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { InfoTip } from "@/components/ui/info-tip";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ConnectionBody, ConnectionCard, ConnectionFooter, ConnectionNotice } from "./connection-card";

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
  return <ConnectionNotice tone={result.ok ? "success" : "destructive"} title={result.message} />;
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
    if (!response.ok) throw new Error("Please refresh the page.");
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
        title: "Couldn't connect Microsoft 365",
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
      setTestResult({ provider, ok: false, message: "Network error. Please try again." });
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

  const healthy = activeProvider === "smtp"
    ? smtp.host.trim().length > 0
    : microsoftConnection.connected;

  return (
    <ConnectionCard
      icon={Mail}
      title="Email delivery"
      description="Send booking confirmations, invitations, password resets and team invitations through Microsoft 365 or SMTP."
      status={!loaded ? (
        <Skeleton className="h-5 w-24 rounded-full" />
      ) : (
        // The badge reflects actual health, not just the stored preference:
        // an active but unconfigured provider means mail is silently dropped.
        <Badge variant={healthy ? "success" : "destructive"} dot>
          {healthy
            ? activeProvider === "smtp" ? "SMTP active" : "Microsoft 365 active"
            : activeProvider === "smtp" ? "SMTP not configured" : "Microsoft 365 disconnected"}
        </Badge>
      )}
    >
      {!loaded ? (
        <ConnectionBody>
          <Skeleton className="h-9 w-48" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        </ConnectionBody>
      ) : (
        <Tabs value={tab} onValueChange={(value) => setTab(value as EmailProvider)} className="flex flex-1 flex-col">
          <div className="border-t px-5 pt-5">
            <TabsList>
              <TabsTrigger value="microsoft365">Microsoft 365</TabsTrigger>
              <TabsTrigger value="smtp">SMTP</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="microsoft365" className="flex flex-1 flex-col">
            <div className="space-y-5 p-5">
              <div className="rounded-lg border bg-muted/50 p-4">
                <h3 className="text-sm font-medium text-foreground">Before you connect</h3>
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
                  <ExternalLink className="size-3.5" />
                </a>
              </div>

              <Field
                label="Callback URL"
                htmlFor="ms-callback-url"
                aside={<InfoTip>Copy this exactly into the app registration&apos;s Web redirect URI.</InfoTip>}
              >
                <div className="flex gap-2">
                  <Input id="ms-callback-url" value={callbackUrl} readOnly className="font-mono text-meta" />
                  <Button type="button" variant="outline" size="icon" onClick={copyCallback}>
                    {copied ? <Check /> : <Copy />}
                    <span className="sr-only">Copy callback URL</span>
                  </Button>
                </div>
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Directory (tenant) ID"
                  htmlFor="ms-tenant-id"
                  aside={<InfoTip>Find this on the app registration Overview page.</InfoTip>}
                >
                  <Input
                    id="ms-tenant-id"
                    value={microsoft.tenantId}
                    onChange={(event) =>
                      setMicrosoft({ ...microsoft, tenantId: event.target.value })}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Application (client) ID" htmlFor="ms-client-id">
                  <Input
                    id="ms-client-id"
                    value={microsoft.clientId}
                    onChange={(event) =>
                      setMicrosoft({ ...microsoft, clientId: event.target.value })}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Client secret" htmlFor="ms-client-secret" className="sm:col-span-2">
                  <Input
                    id="ms-client-secret"
                    value={microsoft.clientSecret}
                    onChange={(event) =>
                      setMicrosoft({ ...microsoft, clientSecret: event.target.value })}
                    type="password"
                    placeholder={microsoftSecretConfigured
                      ? "Saved. Leave blank to keep it."
                      : "Paste the secret value, not its Secret ID"}
                    autoComplete="new-password"
                  />
                </Field>
                <Field
                  label="Sender name"
                  htmlFor="ms-from-name"
                  hint="The email address comes from the Microsoft mailbox you connect."
                  className="sm:col-span-2"
                >
                  <Input
                    id="ms-from-name"
                    value={microsoft.fromName}
                    onChange={(event) =>
                      setMicrosoft({ ...microsoft, fromName: event.target.value })}
                    placeholder="Tidetime"
                  />
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3">
                {microsoftConnection.connected && microsoftConnection.account ? (
                  <>
                    <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Connected as {microsoftConnection.account.name}
                      </p>
                      <p className="truncate text-meta text-muted-foreground">
                        {microsoftConnection.account.email}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={disconnectMicrosoft} loading={pending}>
                      <Unplug />
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <>
                    <Unplug className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <p className="text-sm text-muted-foreground">
                      No Microsoft 365 mailbox is connected yet.
                    </p>
                  </>
                )}
              </div>

              <TestResult provider="microsoft365" result={testResult} />
            </div>

            <ConnectionFooter>
              {microsoftConnection.connected ? (
                <>
                  {activeProvider !== "microsoft365" ? (
                    <Button variant="secondary" onClick={() => activate("microsoft365")} loading={pending}>
                      Use Microsoft 365
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    onClick={() => test("microsoft365")}
                    loading={testing === "microsoft365"}
                  >
                    Send test email
                  </Button>
                </>
              ) : null}
              <Button variant="outline" onClick={saveMicrosoftOnly} loading={pending}>
                Save app details
              </Button>
              <Button onClick={connectMicrosoft} loading={connecting || pending}>
                {microsoftConnection.connected ? "Reconnect mailbox" : "Connect Microsoft 365"}
              </Button>
            </ConnectionFooter>
          </TabsContent>

          <TabsContent value="smtp" className="flex flex-1 flex-col">
            <div className="space-y-5 p-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="SMTP host" htmlFor="smtp-host">
                  <Input
                    id="smtp-host"
                    value={smtp.host}
                    onChange={(event) => setSmtp({ ...smtp, host: event.target.value })}
                    placeholder="smtp.example.com"
                  />
                </Field>
                <Field
                  label="Port"
                  htmlFor="smtp-port"
                  aside={<InfoTip>Common values are 587 for STARTTLS or 465 for implicit TLS.</InfoTip>}
                >
                  <Input
                    id="smtp-port"
                    value={smtp.port}
                    onChange={(event) => setSmtp({ ...smtp, port: event.target.value })}
                    inputMode="numeric"
                    placeholder="587"
                    className="tabular-nums"
                  />
                </Field>
                <Field label="Username" htmlFor="smtp-user">
                  <Input
                    id="smtp-user"
                    value={smtp.user}
                    onChange={(event) => setSmtp({ ...smtp, user: event.target.value })}
                    placeholder="user@example.com"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Password" htmlFor="smtp-pass">
                  <Input
                    id="smtp-pass"
                    value={smtp.pass}
                    onChange={(event) => setSmtp({ ...smtp, pass: event.target.value })}
                    type="password"
                    placeholder={smtpPasswordConfigured
                      ? "Saved. Leave blank to keep it."
                      : "SMTP password"}
                    autoComplete="new-password"
                  />
                </Field>
                <Field
                  label="From address"
                  htmlFor="smtp-from"
                  aside={<InfoTip>For example: Tidetime &lt;noreply@example.com&gt;.</InfoTip>}
                  className="sm:col-span-2"
                >
                  <Input
                    id="smtp-from"
                    value={smtp.from}
                    onChange={(event) => setSmtp({ ...smtp, from: event.target.value })}
                    placeholder="Tidetime <noreply@example.com>"
                  />
                </Field>
              </div>

              <TestResult provider="smtp" result={testResult} />
            </div>

            <ConnectionFooter>
              {activeProvider !== "smtp" ? (
                <Button variant="secondary" onClick={() => activate("smtp")} loading={pending}>
                  <Server />
                  Use SMTP
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => test("smtp")}
                loading={testing === "smtp"}
              >
                Test connection
              </Button>
              <Button onClick={saveSmtp} loading={pending}>Save SMTP</Button>
            </ConnectionFooter>
          </TabsContent>
        </Tabs>
      )}
    </ConnectionCard>
  );
}
