"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

/**
 * A small info icon that reveals an explanatory tooltip on hover or focus.
 * Use it sparingly to clarify non-obvious settings without cluttering labels.
 * Requires a `TooltipProvider` ancestor (the dashboard shell provides one).
 */
function InfoTip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Tooltip content={<span className="block max-w-[16rem] leading-snug">{children}</span>}>
      <button
        type="button"
        aria-label="More information"
        className={cn(
          "inline-flex items-center justify-center text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground",
          className,
        )}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
    </Tooltip>
  );
}

export { InfoTip };
