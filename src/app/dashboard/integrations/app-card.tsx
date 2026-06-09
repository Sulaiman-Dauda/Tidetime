"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Calendar, Video, Users, Plug, ExternalLink, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { uninstallApp } from "./actions";

export interface AppCardData {
  slug: string;
  name: string;
  category: "calendar" | "video" | "crm" | "automation" | "payment";
  description: string;
  publisher: string;
  icon: string;
  docsUrl?: string;
  configured: boolean;
  installed: boolean;
  installable: boolean;
  settingsManaged: boolean;
}

const ICONS: Record<string, LucideIcon> = { Calendar, Video, Users };

export function AppCard({ app }: { app: AppCardData }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const Icon = ICONS[app.icon] ?? Plug;

  function disconnect() {
    startTransition(async () => {
      const res = await uninstallApp(app.slug);
      if (res.ok) toast({ title: `${app.name} disconnected` });
      else toast({ title: "Couldn't disconnect", description: res.error, variant: "destructive" });
    });
  }

  const badge = app.installed
    ? { label: "Connected", variant: "success" as const }
    : app.configured
      ? { label: "Available", variant: "outline" as const }
      : { label: "Needs setup", variant: "secondary" as const };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-secondary text-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <div className="flex-1">
        <h2 className="text-sm font-semibold text-foreground">{app.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{app.description}</p>
        <p className="mt-2 text-xs text-muted-foreground">by {app.publisher}</p>
      </div>

      <div className="flex items-center gap-2">
        {app.settingsManaged ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/settings">Manage in Settings</Link>
          </Button>
        ) : !app.configured ? (
          <Button variant="outline" size="sm" disabled>
            Configure on server
          </Button>
        ) : app.installed && app.installable ? (
          <Button variant="outline" size="sm" onClick={disconnect} disabled={pending}>
            {pending ? "Disconnecting…" : "Disconnect"}
          </Button>
        ) : app.installable ? (
          <Button asChild size="sm">
            <a href={`/api/apps/${app.slug}/install`}>Connect</a>
          </Button>
        ) : app.installed ? (
          <Button variant="outline" size="sm" disabled>
            Active
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/settings">Connect a prerequisite</Link>
          </Button>
        )}

        {app.docsUrl ? (
          <Button asChild variant="ghost" size="sm">
            <a href={app.docsUrl} target="_blank" rel="noreferrer" className="gap-1">
              Docs <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
