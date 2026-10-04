import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Standard dashboard page header: title, optional description, optional
 * right-aligned actions. Detail pages pass `back` for the link to their list.
 */
function PageHeader({
  title,
  description,
  action,
  back,
  meta,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  back?: { href: string; label: string };
  /** Inline next to the title, e.g. a status badge. */
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {back ? (
        <Link
          href={back.href as Route}
          className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 text-meta font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {meta}
          </div>
          {description ? (
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}

export { PageHeader };
