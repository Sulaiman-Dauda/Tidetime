import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { WaveMark } from "@/components/wave-mark";

interface EmptyStateProps {
  icon?: LucideIcon;
  /** Show the Tidetime mark instead of a plain icon. */
  brand?: boolean;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Drop the card frame when the empty state already sits inside a card. */
  bare?: boolean;
  className?: string;
}

function EmptyState({
  icon: Icon,
  brand,
  title,
  description,
  action,
  bare,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        !bare && "rounded-xl border bg-card shadow-xs",
        className,
      )}
    >
      {brand ? (
        <WaveMark size={40} className="mb-4" />
      ) : Icon ? (
        <div className="mb-4 flex size-10 items-center justify-center rounded-lg border bg-background shadow-xs">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      )}
      {action && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>
      )}
    </div>
  );
}

export { EmptyState };
