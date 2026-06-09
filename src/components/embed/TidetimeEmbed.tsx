"use client";

/**
 * Tidetime embed — React wrapper.
 *
 * A dependency-free component (copy it into any React app) that loads the
 * Tidetime embed SDK and renders either an auto-resizing **inline** booking
 * widget or a **popup** trigger, while exposing the documented lifecycle as
 * React callbacks. See ../../../docs/EMBED_LIFECYCLE.md for the protocol.
 *
 *   // Inline
 *   <TidetimeEmbed url="https://app.tidetime.com/jane/intro" theme="dark"
 *     onBookingSuccessful={(d) => track("booked", d)} />
 *
 *   // Popup
 *   <TidetimeEmbed mode="popup" url="https://app.tidetime.com/jane/intro">
 *     Book a call
 *   </TidetimeEmbed>
 */

import * as React from "react";

type TidetimeAction =
  | "init"
  | "config"
  | "inline"
  | "prerender"
  | "popup"
  | "modal"
  | "floatingButton"
  | "on";

type TidetimeFn = ((action: TidetimeAction, opts?: Record<string, unknown>) => void) & {
  q?: unknown[];
};

declare global {
  interface Window {
    Tidetime?: TidetimeFn;
  }
}

export type EmbedTheme = "light" | "dark";

export interface TidetimeEmbedProps {
  /** Full booking page URL, e.g. https://app.tidetime.com/jane/intro */
  url: string;
  /** "inline" renders an auto-resizing widget; "popup" renders a trigger. */
  mode?: "inline" | "popup";
  /** Match the host site's colour scheme. */
  theme?: EmbedTheme;
  /**
   * Where to load embed.js from. Defaults to `<url origin>/embed.js` so it comes
   * from the same deployment that serves the booking page (keeping protocol
   * versions in sync). Override for a custom domain.
   */
  scriptSrc?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Popup trigger content (mode="popup"). Defaults to a "Book a time" button. */
  children?: React.ReactNode;
  /** Fires once the in-frame app has mounted and completed the handshake. */
  onReady?: (data: unknown) => void;
  /** Fires when a booking is confirmed. */
  onBookingSuccessful?: (data: unknown) => void;
  /** Fires when the iframe fails to load. */
  onLinkFailed?: (data: unknown) => void;
  /** Fires when the iframe document loads (coarse). */
  onFrameLoaded?: (data: unknown) => void;
}

/** Resolve the SDK URL from the booking URL's origin unless overridden. */
function resolveScriptSrc(url: string, override?: string): string | null {
  if (override) return override;
  try {
    return `${new URL(url).origin}/embed.js`;
  } catch {
    return null;
  }
}

/** Load embed.js exactly once per src, queueing calls until it's ready. */
const scriptPromises = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const existing = scriptPromises.get(src);
  if (existing) return existing;

  // Stub the global so calls made before the script loads are queued + drained.
  if (!window.Tidetime) {
    const stub: TidetimeFn = function (...args: unknown[]) {
      (stub.q = stub.q || []).push(args);
    } as unknown as TidetimeFn;
    window.Tidetime = stub;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const prior = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (prior) {
      if (prior.dataset.loaded === "1") resolve();
      else {
        prior.addEventListener("load", () => resolve());
        prior.addEventListener("error", () => reject(new Error("embed.js failed to load")));
      }
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.addEventListener("load", () => {
      el.dataset.loaded = "1";
      resolve();
    });
    el.addEventListener("error", () => reject(new Error("embed.js failed to load")));
    document.head.appendChild(el);
  });
  scriptPromises.set(src, promise);
  return promise;
}

export function TidetimeEmbed({
  url,
  mode = "inline",
  theme,
  scriptSrc,
  className,
  style,
  children,
  onReady,
  onBookingSuccessful,
  onLinkFailed,
  onFrameLoaded,
}: TidetimeEmbedProps) {
  const inlineRef = React.useRef<HTMLDivElement>(null);

  // Keep the latest callbacks in a ref: the SDK has no "off", so we register
  // stable handlers once and dispatch to current callbacks while mounted.
  const handlers = React.useRef({ onReady, onBookingSuccessful, onLinkFailed, onFrameLoaded });
  handlers.current = { onReady, onBookingSuccessful, onLinkFailed, onFrameLoaded };

  const src = resolveScriptSrc(url, scriptSrc);

  React.useEffect(() => {
    if (!src) return;
    let alive = true;

    loadScript(src)
      .then(() => {
        if (!alive) return;
        const T = window.Tidetime;
        if (!T) return;

        if (theme) T("config", { theme });

        // Wire lifecycle events to the latest callbacks (gated by `alive`).
        T("on", {
          event: "ready",
          handler: (d: unknown) => alive && handlers.current.onReady?.(d),
        });
        T("on", {
          event: "bookingSuccessful",
          handler: (d: unknown) => alive && handlers.current.onBookingSuccessful?.(d),
        });
        T("on", {
          event: "linkFailed",
          handler: (d: unknown) => alive && handlers.current.onLinkFailed?.(d),
        });
        T("on", {
          event: "frameLoaded",
          handler: (d: unknown) => alive && handlers.current.onFrameLoaded?.(d),
        });

        if (mode === "inline" && inlineRef.current) {
          T("inline", { target: inlineRef.current, url });
        } else if (mode === "popup") {
          T("prerender", { url });
        }
      })
      .catch(() => {
        if (alive) handlers.current.onLinkFailed?.({ url });
      });

    return () => {
      alive = false;
    };
  }, [src, url, mode, theme]);

  if (mode === "popup") {
    return (
      <button
        type="button"
        className={className}
        style={style}
        onMouseEnter={() => window.Tidetime?.("prerender", { url })}
        onClick={() => window.Tidetime?.("popup", { url })}
      >
        {children ?? "Book a time"}
      </button>
    );
  }

  return <div ref={inlineRef} className={className} style={style} />;
}
