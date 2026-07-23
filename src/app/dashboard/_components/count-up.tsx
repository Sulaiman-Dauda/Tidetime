"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number counting up from 0 on mount (easeOutCubic). Respects
 * reduced-motion and renders the final value instantly for 0. Pure rAF, no deps.
 */
export function CountUp({
  value,
  durationMs = 750,
  className,
}: {
  value: number;
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value <= 0) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    setDisplay(0);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value, durationMs]);

  return <span className={className}>{display}</span>;
}
