import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-grid">
      <div className="h-1 w-full bg-primary" aria-hidden />
      <div className="mx-auto flex min-h-[calc(100vh-4px)] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary/12 text-primary">
          <Compass className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">That page doesn&apos;t exist</h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
          The link may be wrong, expired, or no longer public. If this is a booking page, ask the host for a fresh link.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/">Go to home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">
              <ArrowLeft className="h-4 w-4" /> Back to login
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
