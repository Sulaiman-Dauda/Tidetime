"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A hairline progress bar at the very top of the app. It starts when an internal
 * link is clicked and completes when the new route resolves — the "expensive
 * SaaS" navigation cue (Linear/Vercel style). Pure state + CSS, no library.
 */
function RouteProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams?.toString() ?? "";
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timers = useRef<number[]>([]);
  const first = useRef(true);
  const reduce = useRef(false);

  function clearTimers() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }

  function start() {
    if (reduce.current) return;
    clearTimers();
    setVisible(true);
    setWidth(10);
    timers.current.push(window.setTimeout(() => setWidth(40), 90));
    timers.current.push(window.setTimeout(() => setWidth(70), 350));
    timers.current.push(window.setTimeout(() => setWidth(88), 900));
    // Safety: never leave the bar hanging if navigation is cancelled.
    timers.current.push(window.setTimeout(() => finish(), 8000));
  }

  function finish() {
    clearTimers();
    setWidth(100);
    timers.current.push(window.setTimeout(() => setVisible(false), 240));
    timers.current.push(window.setTimeout(() => setWidth(0), 480));
  }

  useEffect(() => {
    reduce.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (href === window.location.pathname + window.location.search) return;
      start();
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Complete the bar once the destination route (path or query) has resolved.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchKey]);

  if (!visible) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[2px]">
      <div
        className="h-full rounded-r-full bg-primary transition-[width] duration-200 ease-out"
        style={{ width: `${width}%`, boxShadow: "0 0 8px hsl(var(--primary) / 0.6)" }}
      />
    </div>
  );
}

export function RouteProgress() {
  return (
    <Suspense fallback={null}>
      <RouteProgressInner />
    </Suspense>
  );
}
