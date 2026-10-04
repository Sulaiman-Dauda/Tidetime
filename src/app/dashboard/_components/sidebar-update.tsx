"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpCircle, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  // Non-admins get 403 (status stays null), so they see nothing here.
  if (!status) return null;

  if (phase === "done") {
    return (
      <div className="mx-3 mb-1 flex items-center gap-1.5 rounded-lg bg-success-subtle px-2.5 py-1.5 text-xs font-medium text-success">
        <Check className="size-3.5 shrink-0" /> Updated
      </div>
    );
  }

  if (!status.updateAvailable) {
    return <div className="px-5 pb-1 text-xs text-muted-foreground">Tidetime v{status.version}</div>;
  }

  return (
    <div className="mx-3 mb-1 rounded-lg border bg-background p-3 shadow-xs">
      <div className="flex items-center gap-1.5 text-meta font-medium text-foreground">
        <ArrowUpCircle className="size-4 shrink-0 text-primary" />
        Update available
      </div>
      {status.latestVersion ? (
        <div className="mt-1 text-xs text-muted-foreground">
          v{status.version} to v{status.latestVersion}
        </div>
      ) : null}

      {phase === "manual" ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {copied
            ? "Update command copied. Run it on your server."
            : "Run the update command on your server."}
        </p>
      ) : (
        <Button
          size="sm"
          className="mt-2.5 w-full"
          onClick={onUpdate}
          loading={phase === "updating"}
        >
          {phase === "updating" ? "Updating" : (
            <>
              <Download /> Update now
            </>
          )}
        </Button>
      )}
    </div>
  );
}
