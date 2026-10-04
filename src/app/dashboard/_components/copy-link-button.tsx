"use client";

import { useState } from "react";
import { Check, ExternalLink, Link2 } from "lucide-react";

/** The company booking link: click to copy, arrow to open it in a new tab. */
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
    <div className="flex h-8 min-w-0 items-center rounded-lg border bg-background shadow-xs">
      <button
        type="button"
        onClick={copy}
        title={copied ? "Copied" : `Copy ${label}`}
        className="flex h-full min-w-0 items-center gap-2 rounded-l-lg px-2.5 text-meta text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {copied ? (
          <Check className="size-3.5 shrink-0 text-success" />
        ) : (
          <Link2 className="size-3.5 shrink-0" />
        )}
        {/* The URL is long; on phones the icon alone carries the action. */}
        <span className="hidden truncate sm:inline sm:max-w-64 lg:max-w-80">
          {copied ? "Link copied" : label}
        </span>
        <span className="sr-only sm:hidden">Copy booking link</span>
      </button>
      <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open booking page"
        className="flex size-8 shrink-0 items-center justify-center rounded-r-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <ExternalLink className="size-3.5" />
        <span className="sr-only">Open booking page</span>
      </a>
    </div>
  );
}
