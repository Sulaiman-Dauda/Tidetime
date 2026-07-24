"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpCircle, ExternalLink, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpdateStatus {
  current: string | null;
  latestShort: string | null;
  currentShort: string | null;
  behind: number | null;
  updateAvailable: boolean;
  compareUrl: string | null;
  updaterAvailable: boolean;
  progress: string | null;
}

type Phase = "idle" | "updating" | "done" | "manual";

const MANUAL_COMMAND =
  "docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d";

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [copied, setCopied] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedFrom = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/updates", { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as UpdateStatus;
      setStatus(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [load]);

  // While updating, poll until the running commit catches up (or the sidecar
  // reports done/failed). The app restarts mid-update, so fetches may fail for
  // a bit — that is expected.
  useEffect(() => {
    if (phase !== "updating") return;
    poll.current = setInterval(async () => {
      const data = await load();
      if (!data) return;
      const from = startedFrom.current;
      const moved = from && data.current && data.current !== from;
      if (moved || data.progress === "done" || !data.updateAvailable) {
        setPhase("done");
      } else if (data.progress === "failed") {
        setPhase("idle");
      }
    }, 5000);
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [phase, load]);

  async function onUpdate() {
    startedFrom.current = status?.current ?? null;
    setPhase("updating");
    try {
      const res = await fetch("/api/updates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update" }),
      });
      const data = (await res.json()) as { triggered?: boolean };
      if (!data.triggered) setPhase("manual");
    } catch {
      setPhase("manual");
    }
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(MANUAL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  if (phase === "done") {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
        <Check className="h-4 w-4 shrink-0" />
        Tidetime was updated. If anything looks off, reload the page.
      </div>
    );
  }

  if (!status?.updateAvailable) return null;

  const count = status.behind ?? 0;
  const commits = `${count} new commit${count === 1 ? "" : "s"}`;

  return (
    <div className="mb-6 rounded-xl border border-brand/25 bg-accent/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ArrowUpCircle className="h-5 w-5 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            An update is available{status.latestShort ? ` (${commits})` : ""}.
          </p>
          <p className="text-xs text-muted-foreground">
            {status.currentShort ? `Running ${status.currentShort}` : "Running an unknown build"}
            {status.latestShort ? ` · latest ${status.latestShort}` : ""}.
          </p>
        </div>

        {status.compareUrl && (
          <a
            href={status.compareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
          >
            View changes <ExternalLink className="h-3 w-3" />
          </a>
        )}

        {phase === "updating" ? (
          <Button size="sm" disabled className="gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…
          </Button>
        ) : (
          <Button size="sm" onClick={onUpdate}>Update now</Button>
        )}
      </div>

      {phase === "updating" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Pulling the new image and restarting. This takes a minute and the app will briefly go offline.
        </p>
      )}

      {phase === "manual" && (
        <div className="mt-3 rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">
            One-click update needs the optional updater service. Until it&apos;s enabled, run this on your server:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-[11px] text-foreground">
              {MANUAL_COMMAND}
            </code>
            <Button size="sm" variant="outline" onClick={copyCommand} className="gap-1.5 shrink-0">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
