import { cn } from "@/lib/utils";

/**
 * The Tidetime mark: two tide lines on an indigo tile. Static on purpose; the
 * product feels calmer without a logo that moves. Used by the sidebar, the
 * auth screens and branded empty states.
 */
export function WaveMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-button",
        className,
      )}
      style={{ height: size, width: size }}
      aria-hidden
    >
      <svg width={size * 0.54} height={size * 0.4} viewBox="0 0 15 11" fill="none">
        <path
          d="M1 8.5C2.5 6.167 4 6.167 5.5 8.5S8.5 10.833 10 8.5s3-2.333 4.5 0"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M1 3.5C2.5 1.167 4 1.167 5.5 3.5S8.5 5.833 10 3.5s3-2.333 4.5 0"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
