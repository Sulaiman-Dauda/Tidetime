"use client";

import Link from "next/link";
import { useEffect } from "react";
import localFont from "next/font/local";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "./_components/status-screen";
import "./globals.css";

// This page replaces the root layout, so it brings its own stylesheet and font
// (the same Geist file layout.tsx loads) instead of relying on them being there.
const geist = localFont({
  src: [{ path: "../../public/fonts/Geist-Variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-sans",
  display: "swap",
});

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // The theme provider lives in the root layout and isn't mounted here, so
  // apply the saved choice (or the system setting) to the page directly.
  useEffect(() => {
    let theme: string | null = null;
    try {
      theme = localStorage.getItem("theme");
    } catch {
      /* storage blocked: fall back to the system setting */
    }
    const dark =
      theme === "dark" ||
      (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  return (
    <html lang="en">
      <body className={`${geist.variable} font-sans`}>
        <StatusScreen
          icon={TriangleAlert}
          title="Something went wrong"
          description="Tidetime couldn't load this page. Try again, and if it keeps happening, check the server logs."
        >
          <Button onClick={reset}>
            <RotateCcw /> Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go to home</Link>
          </Button>
        </StatusScreen>
      </body>
    </html>
  );
}
