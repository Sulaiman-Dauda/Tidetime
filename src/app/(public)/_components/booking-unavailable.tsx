import { CalendarOff } from "lucide-react";
import { CompanyBrandHeader } from "./company-brand-header";
import { PublicLegal } from "./public-legal";

/** Shown on the public booking pages while Settings has booking switched off. */
export function BookingUnavailable() {
  return (
    <main className="flex min-h-screen flex-col bg-canvas">
      <CompanyBrandHeader />
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:py-14">
        <div className="flex flex-col items-center rounded-2xl bg-card px-6 py-12 text-center text-card-foreground shadow-popover">
          <div className="flex size-10 items-center justify-center rounded-lg border bg-background shadow-xs">
            <CalendarOff className="size-5 text-muted-foreground" aria-hidden />
          </div>
          <h1 className="mt-4 text-base font-semibold tracking-tight">
            Booking temporarily unavailable
          </h1>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            Online booking is currently disabled while we make some improvements. Please check
            back soon or contact us directly.
          </p>
        </div>
      </div>
      <PublicLegal />
    </main>
  );
}
