"use client";

import { useEffect, useState } from "react";
import { WaveMark } from "@/components/wave-mark";

/**
 * Premium auth motion — all pure CSS/SVG (see the `tt-*` keyframes in
 * globals.css), no animation library. The one-time landing splash.
 */

const SEEN_KEY = "tt_intro_seen";

/**
 * One-time landing splash: the wave mark draws itself, the wordmark prints in
 * letter by letter, then the whole overlay fades to reveal the auth page.
 * Plays once per browser session and is skipped for reduced-motion users.
 */
export function AuthIntro() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = false;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce) return;

    setShow(true);
    const leaveTimer = setTimeout(() => setLeaving(true), 1650);
    const doneTimer = setTimeout(() => {
      setShow(false);
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* ignore */
      }
    }, 2200);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden
    >
      <div className="bg-dot-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative flex flex-col items-center gap-5">
        <WaveMark size={84} />
        <div className="flex">
          {"Tidetime".split("").map((ch, i) => (
            <span
              key={i}
              className="text-2xl font-semibold tracking-tight text-foreground"
              style={{
                animation: "tt-rise 0.5s cubic-bezier(0.22,1,0.36,1) both",
                animationDelay: `${0.55 + i * 0.05}s`,
              }}
            >
              {ch}
            </span>
          ))}
        </div>
        <p
          className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground"
          style={{ animation: "tt-fade 0.6s ease 1.05s both" }}
        >
          Scheduling, refined
        </p>
      </div>
    </div>
  );
}
