"use client";

import { useEffect } from "react";

/**
 * In-iframe half of the embed lifecycle. Mounted only when a public booking page
 * renders inside an embed. Responsibilities:
 *
 *  1. Handshake — broadcast `tidetime:ready` (with protocol version) on a short
 *     retry loop until the host SDK replies `tidetime:ack`. This fixes the race
 *     where a *prerendered* frame finishes loading before the SDK attaches its
 *     message listener, which otherwise left popups blank until a reload.
 *  2. Sizing — stream document height so inline embeds auto-size.
 *  3. Config — apply host-provided config (currently theme) sent via
 *     `tidetime:connect`, so the embed can match the host site's light/dark mode.
 *
 * Protocol messages are namespaced `tidetime:*` and carry `v: 1`.
 */
const PROTOCOL_VERSION = 1;

export function EmbedBridge() {
  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;

    const post = (type: string, extra: Record<string, unknown> = {}) => {
      try {
        window.parent.postMessage({ type, v: PROTOCOL_VERSION, ...extra }, "*");
      } catch {
        // cross-origin restrictions — nothing to do
      }
    };

    let last = -1;
    const sendHeight = () => {
      const h = Math.ceil(
        Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
      );
      if (h !== last) {
        last = h;
        post("tidetime:resize", { height: h });
      }
    };

    // Handshake: announce readiness on a backoff until acknowledged.
    let acked = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const announce = () => {
      if (acked) return;
      post("tidetime:ready");
      sendHeight();
      if (attempts++ < 12) timer = setTimeout(announce, Math.min(100 * attempts, 1000));
    };

    const applyTheme = (theme: unknown) => {
      if (theme === "dark" || theme === "light") {
        document.documentElement.dataset.embedTheme = theme;
        document.documentElement.classList.toggle("dark", theme === "dark");
      }
    };

    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "tidetime:ack") {
        acked = true;
        if (timer) clearTimeout(timer);
      } else if (d.type === "tidetime:connect") {
        acked = true;
        if (timer) clearTimeout(timer);
        applyTheme(d.theme);
        sendHeight();
      }
    };

    window.addEventListener("message", onMessage);
    announce();

    const ro = new ResizeObserver(sendHeight);
    ro.observe(document.documentElement);
    if (document.body) ro.observe(document.body);
    window.addEventListener("load", sendHeight);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      ro.disconnect();
      window.removeEventListener("load", sendHeight);
    };
  }, []);

  return null;
}
