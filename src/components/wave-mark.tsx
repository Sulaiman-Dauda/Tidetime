import { cn } from "@/lib/utils";

/**
 * The animated Tidetime brand mark — the tide waves draw themselves in and bob
 * gently. Pure CSS/SVG (see the `tt-*` keyframes in globals.css), no client JS,
 * so it works in both server and client components. Shared by the auth splash,
 * the sign-in screen, and empty states to tie the brand together.
 */
export function WaveMark({
  size = 80,
  pulse = true,
  className,
}: {
  size?: number;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25",
        className,
      )}
      style={{ height: size, width: size, animation: "tt-pop 0.6s cubic-bezier(0.22,1,0.36,1) both" }}
    >
      {pulse ? (
        <span
          className="absolute inset-0 rounded-2xl ring-1 ring-primary/40"
          style={{ animation: "tt-ring 1.7s ease-out 0.4s infinite" }}
          aria-hidden
        />
      ) : null}
      <svg width={size * 0.5} height={size * 0.38} viewBox="0 0 15 11" fill="none" aria-hidden>
        <path
          d="M1 8.5C2.5 6.167 4 6.167 5.5 8.5S8.5 10.833 10 8.5s3-2.333 4.5 0"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeDasharray="30"
          style={{ animation: "tt-wave-draw 0.7s ease-out 0.25s both, tt-wave-bob 2.6s ease-in-out 1s infinite" }}
        />
        <path
          d="M1 3.5C2.5 1.167 4 1.167 5.5 3.5S8.5 5.833 10 3.5s3-2.333 4.5 0"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeDasharray="30"
          style={{ animation: "tt-wave-draw 0.7s ease-out 0.45s both, tt-wave-bob 2.6s ease-in-out 1.15s infinite" }}
        />
      </svg>
    </div>
  );
}
