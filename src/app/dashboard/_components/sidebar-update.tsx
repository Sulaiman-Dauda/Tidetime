"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpCircle, Check, Loader2, Download } from "lucide-react";

interface UpdateStatus {
  version: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  updaterAvailable: boolean;
  progress: string | null;
}

type Phase = "idle" | "updating" | "done" | "manual";

const MANUAL_COMMAND =
  "docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d";

/**
 * Compact version + update control for the sidebar footer (admins only). Shows
 * the running version; when a newer release exists, offers a one-click update
 * (or copies the manual command when the updater sidecar is not enabled).
 */
export function SidebarUpdate() {
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

  useEffect(() => {
    if (phase !== "updating") return;
    poll.current = setInterval(async () => {
      const data = await load();
      if (!data) return;
      const from = startedFrom.current;
      const moved = from && data.version && data.version !== from;
      if (moved || data.progress === "done" || !data.updateAvailable) setPhase("done");
      else if (data.progress === "failed") setPhase("idle");
    }, 5000);
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [phase, load]);

  async function onUpdate() {
    startedFrom.current = status?.version ?? null;
    setPhase("updating");
    try {
      const res = await fetch("/api/updates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update" }),
      });
      const data = (await res.json()) as { triggered?: boolean };
      if (!data.triggered) {
        try {
          await navigator.clipboard.writeText(MANUAL_COMMAND);
          setCopied(true);
        } catch {
          /* ignore */
        }
        setPhase("manual");
      }
    } catch {
      setPhase("manual");
    }
  }

  // Non-admins get 403 (status stays null) — render nothing.
  if (!status) return null;

  if (phase === "done") {
    return (
      <div className="mx-2 mb-1 flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-[11.5px] text-emerald-700 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5 shrink-0" /> Updated
      </div>
    );
  }

  if (!status.updateAvailable) {
    return (
      <div className="px-3 pb-1 pt-0.5 text-[10.5px] text-muted-foreground/60">
        Tidetime <span className="font-medium">v{status.version}</span>
      </div>
    );
  }

  return (
    <div className="mx-2 mb-1 rounded-lg border border-brand/25 bg-accent/50 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
        <ArrowUpCircle className="h-3.5 w-3.5 shrink-0 text-brand" />
        Update available
      </div>
      {status.latestVersion ? (
        <div className="mt-0.5 pl-[19px] text-[10.5px] font-medium text-muted-foreground">
          v{status.latestVersion}
        </div>
      ) : null}

      {phase === "manual" ? (
        <p className="mt-1.5 text-[10.5px] leading-snug text-muted-foreground">
          {copied
            ? "Command copied — run it on your server to update."
            : "Run the update command on your server."}
        </p>
      ) : (
        <button
          type="button"
          onClick={onUpdate}
          disabled={phase === "updating"}
          className={`mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-[11.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 ${
            phase === "updating" ? "" : "tt-attn"
          }`}
        >
          {phase === "updating" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Updating…
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" /> Update now
            </>
          )}
        </button>
      )}
    </div>
  );
}
