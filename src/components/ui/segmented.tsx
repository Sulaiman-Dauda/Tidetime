"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";

/*
 * The one tab/toggle look in the app: a muted track with the active segment
 * raised on it. Radix Tabs (ui/tabs), link tabs that drive a URL (SegmentedLinks)
 * and plain value toggles (Segmented) all share these classes.
 */
const segmentListClassName =
  "inline-flex h-9 max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground";

const segmentItemClassName =
  "inline-flex h-7 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4";

const segmentActiveClassName = "bg-segment text-foreground shadow-xs";

interface Option<T extends string> {
  value: T;
  label: React.ReactNode;
}

/** A single-choice toggle (e.g. 12h / 24h). Behaves as a radio group. */
function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  className,
  size = "default",
  "aria-label": ariaLabel,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly Option<T>[];
  className?: string;
  size?: "default" | "sm";
  "aria-label": string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(segmentListClassName, size === "sm" && "h-8", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              segmentItemClassName,
              size === "sm" && "h-6 px-2.5 text-meta",
              active && segmentActiveClassName,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Tabs that are links (the selected tab lives in the URL, e.g. ?tab=past). */
function SegmentedLinks({
  items,
  className,
  "aria-label": ariaLabel,
}: {
  items: readonly { href: string; label: React.ReactNode; active: boolean }[];
  className?: string;
  "aria-label": string;
}) {
  return (
    <nav aria-label={ariaLabel} className={cn(segmentListClassName, className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href as Route}
          aria-current={item.active ? "page" : undefined}
          className={cn(segmentItemClassName, item.active && segmentActiveClassName)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export {
  Segmented,
  SegmentedLinks,
  segmentListClassName,
  segmentItemClassName,
  segmentActiveClassName,
};
