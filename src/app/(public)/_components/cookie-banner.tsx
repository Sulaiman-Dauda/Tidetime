"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "tt_cookie_notice_ack";

export function CookieBanner({ content }: { content: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-4 bottom-4 z-50 rounded-xl bg-popover p-4 text-popover-foreground shadow-popover sm:left-6 sm:right-auto sm:bottom-6 sm:max-w-sm"
    >
      <p className="text-sm text-muted-foreground">{content}</p>
      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="outline" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </div>
  );
}
