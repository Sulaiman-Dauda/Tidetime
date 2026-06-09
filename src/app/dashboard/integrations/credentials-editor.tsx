"use client";

import { useState, useTransition } from "react";
import { Copy, Check, ChevronDown, ExternalLink, KeyRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { IntegrationProvider, ProviderCredentialStatus } from "@/server/integration-credentials";
import { saveOAuthCredsAction, saveDailyCredsAction } from "./credential-actions";

interface OAuthDescriptor {
  provider: Exclude<IntegrationProvider, "daily_video">;
  name: string;
  redirectPath: string;
  docsUrl: string;
  docsLabel: string;
}

const OAUTH: OAuthDescriptor[] = [
  { provider: "google_calendar", name: "Google", redirectPath: "/api/google-calendar/callback", docsUrl: "https://console.cloud.google.com/apis/credentials", docsLabel: "Google Cloud Console" },
  { provider: "office365_calendar", name: "Microsoft 365", redirectPath: "/api/microsoft-calendar/callback", docsUrl: "https://portal.azure.com", docsLabel: "Azure Portal" },
  { provider: "zoom_video", name: "Zoom", redirectPath: "/api/apps/zoom_video/callback", docsUrl: "https://marketplace.zoom.us", docsLabel: "Zoom Marketplace" },
  { provider: "hubspot", name: "HubSpot", redirectPath: "/api/apps/hubspot/callback", docsUrl: "https://developers.hubspot.com", docsLabel: "HubSpot Developers" },
];

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-md border border-border/60 bg-secondary/40 px-2.5 py-1.5 text-xs">
        {value}
      </code>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* noop */
          }
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function SourceBadge({ status }: { status: ProviderCredentialStatus }) {
  if (!status.configured) return <Badge variant="secondary">Not set</Badge>;
  return (
    <Badge variant="success">
      {status.source === "env" ? "Set via env" : "Saved"} · {status.clientIdMasked}
    </Badge>
  );
}

function OAuthCard({
  desc,
  status,
  appUrl,
}: {
  desc: OAuthDescriptor;
  status: ProviderCredentialStatus;
  appUrl: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await saveOAuthCredsAction(desc.provider, clientId, clientSecret);
      if (res?.ok) {
        toast({ title: `${desc.name} credentials saved` });
        setClientId("");
        setClientSecret("");
        setOpen(false);
      } else {
        toast({ title: "Couldn't save", description: res?.error, variant: "destructive" });
      }
    });
  }

  return (
    <Card className="p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="h-4 w-4 text-muted-foreground" /> {desc.name}
        </span>
        <span className="flex items-center gap-2">
          <SourceBadge status={status} />
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open ? (
        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          <div className="space-y-1.5">
            <Label>Redirect URI (add this in {desc.name})</Label>
            <CopyField value={`${appUrl}${desc.redirectPath}`} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${desc.provider}-id`}>Client ID</Label>
            <Input
              id={`${desc.provider}-id`}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={status.configured ? "Leave blank to keep current" : "Paste Client ID"}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${desc.provider}-secret`}>Client Secret</Label>
            <Input
              id={`${desc.provider}-secret`}
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={status.configured ? "Leave blank to keep current" : "Paste Client Secret"}
              autoComplete="off"
            />
          </div>
          <div className="flex items-center justify-between">
            <a
              href={desc.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
            >
              {desc.docsLabel} <ExternalLink className="h-3 w-3" />
            </a>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function DailyCard({ status }: { status: ProviderCredentialStatus }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await saveDailyCredsAction(apiKey, subdomain);
      if (res?.ok) {
        toast({ title: "Daily credentials saved" });
        setApiKey("");
        setSubdomain("");
        setOpen(false);
      } else {
        toast({ title: "Couldn't save", description: res?.error, variant: "destructive" });
      }
    });
  }

  return (
    <Card className="p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="h-4 w-4 text-muted-foreground" /> Daily
        </span>
        <span className="flex items-center gap-2">
          <SourceBadge status={status} />
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open ? (
        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="daily-key">API key</Label>
            <Input
              id="daily-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={status.configured ? "Leave blank to keep current" : "Paste Daily API key"}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="daily-subdomain">Subdomain (optional)</Label>
            <Input id="daily-subdomain" value={subdomain} onChange={(e) => setSubdomain(e.target.value)} placeholder="your-team" />
          </div>
          <div className="flex items-center justify-between">
            <a href="https://dashboard.daily.co/developers" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:underline">
              Daily dashboard <ExternalLink className="h-3 w-3" />
            </a>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Verifying…" : "Save"}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export function CredentialsEditor({
  appUrl,
  statuses,
}: {
  appUrl: string;
  statuses: Record<IntegrationProvider, ProviderCredentialStatus>;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Provider credentials</h2>
        <p className="text-xs text-muted-foreground">
          One-time setup by an admin. Register an OAuth app with each provider, add the redirect URI
          shown below, then paste the credentials here. Stored encrypted — no redeploy needed.
        </p>
      </div>
      {OAUTH.map((d) => (
        <OAuthCard key={d.provider} desc={d} status={statuses[d.provider]} appUrl={appUrl} />
      ))}
      <DailyCard status={statuses.daily_video} />
    </div>
  );
}
