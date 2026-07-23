import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { WaveMark } from "@/components/wave-mark";

interface EmptyStateProps {
  icon?: LucideIcon;
  /** Show the animated Tidetime wave mark instead of a plain icon. */
  brand?: boolean;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

function EmptyState({ icon: Icon, brand, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center",
        className,
      )}
    >
      {brand ? (
        <WaveMark size={52} pulse={false} className="mb-4 rounded-xl" />
      ) : Icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      ) : null}
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export { EmptyState };
