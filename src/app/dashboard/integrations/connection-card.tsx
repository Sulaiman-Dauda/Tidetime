import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * One connection on the Connections page: icon tile, name, one-line
 * description and status badge, then the connection's own settings. Put
 * settings in ConnectionBody and actions in ConnectionFooter so every card
 * places its buttons the same way.
 */
function ConnectionCard({
  icon: Icon,
  title,
  description,
  status,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  status?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-start gap-3 p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background shadow-xs">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold leading-6 tracking-tight text-foreground">{title}</h2>
            {status}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

function ConnectionBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-5 border-t p-5", className)} {...props} />;
}

/** Actions strip pinned to the bottom of the card, primary action last. */
function ConnectionFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <CardFooter className={cn("mt-auto flex-wrap", className)} {...props} />;
}

const noticeTone = {
  success: { className: "bg-success-subtle text-success", icon: CheckCircle2 },
  warning: { className: "bg-warning-subtle text-warning", icon: AlertTriangle },
  destructive: { className: "bg-destructive-subtle text-destructive", icon: XCircle },
} as const;

/** A short status message inside a card body (expired token, test result). */
function ConnectionNotice({
  tone,
  title,
  children,
}: {
  tone: keyof typeof noticeTone;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { className, icon: Icon } = noticeTone[tone];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm", className)} role="status">
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">{title}</p>
        {children ? <p className="text-muted-foreground">{children}</p> : null}
      </div>
    </div>
  );
}

export { ConnectionCard, ConnectionBody, ConnectionFooter, ConnectionNotice };
