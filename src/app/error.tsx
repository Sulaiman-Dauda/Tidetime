"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-grid">
      <div className="h-1 w-full bg-primary" aria-hidden />
      <div className="mx-auto flex min-h-[calc(100vh-4px)] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-primary">Something went wrong</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">We couldn&apos;t load this page</h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
          Nothing has been deleted. Try again, or head back to safety and continue from there.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go to home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
