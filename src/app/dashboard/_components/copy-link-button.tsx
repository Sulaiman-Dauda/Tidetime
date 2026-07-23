"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

export function CopyLinkButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={copy}
        className="group flex h-8 min-w-0 items-center gap-2 rounded-full border border-border/60 bg-card px-3 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
        ) : (
          <Copy className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate font-mono max-w-[45vw] sm:max-w-none">{label}</span>
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open booking page"
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
