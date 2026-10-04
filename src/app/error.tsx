"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "./_components/status-screen";

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
    <StatusScreen
      icon={TriangleAlert}
      title="We couldn't load this page"
      description="Nothing has been lost. Try again, and if it keeps happening, come back in a few minutes."
    >
      <Button onClick={reset}>
        <RotateCcw /> Try again
      </Button>
      <Button asChild variant="outline">
        <Link href="/">Go to home</Link>
      </Button>
    </StatusScreen>
  );
}
