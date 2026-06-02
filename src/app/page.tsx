import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  Globe2,
  Plug,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser, hasAnyUser } from "@/lib/auth";

export default async function HomePage() {
  if (!(await hasAnyUser())) redirect("/setup");
  const user = await getCurrentUser();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Ambient brand glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-brand-aura"
        aria-hidden
      />
      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-dot-grid opacity-60"
        aria-hidden
      />

      {/* ── Header ── */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5 select-none">
          <TideLogo />
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            Tidetime
          </span>
        </Link>
        <nav className="flex items-center gap-1.5">
          {user ? (
            <Button asChild size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">
                  Get started
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="relative z-10 flex-1">
        {/* ── Hero ── */}
        <section className="mx-auto max-w-4xl px-6 pb-20 pt-24 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <Sparkles className="h-3 w-3 text-brand" />
            Open-source · Self-hostable · 2026
          </div>

          <h1 className="text-balance text-[52px] font-semibold leading-[1.1] tracking-[-0.03em] text-gradient-brand sm:text-[64px]">
            Scheduling,<br />perfected.
          </h1>

          <p className="mx-auto mt-6 max-w-lg text-balance text-[17px] leading-relaxed text-muted-foreground">
            One link. People pick a time. No back-and-forth. Tidetime is the fast,
            elegant alternative to Calendly — built for teams that move fast.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href={user ? "/dashboard" : "/signup"}>
                {user ? "Go to dashboard" : "Start for free"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#features">See features</Link>
            </Button>
          </div>

          <p className="mt-5 text-xs text-muted-foreground/70">
            No credit card required · MIT licensed · Self-host in minutes
          </p>
        </section>

        {/* ── Feature grid ── */}
        <section
          id="features"
          className="mx-auto max-w-7xl px-6 pb-28"
        >
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Everything scheduling needs. Nothing it doesn&apos;t.
            </h2>
          </div>
          <div className="grid gap-px rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon={<Zap className="h-4 w-4" />}
              title="Instant booking pages"
              body="Server-rendered at the edge. Loads before your attendees can blink."
              first
            />
            <Feature
              icon={<Globe2 className="h-4 w-4" />}
              title="Timezone-perfect"
              body="DST-aware slot math. Attendees always see the right time, wherever they are."
            />
            <Feature
              icon={<CalendarClock className="h-4 w-4" />}
              title="Real availability"
              body="Working hours, overrides, buffers, minimum notice, and booking limits — all built in."
              lastInRow
            />
            <Feature
              icon={<Plug className="h-4 w-4" />}
              title="API & webhooks"
              body="REST API, signed webhooks, embeds. Automate every part of your scheduling stack."
            />
            <Feature
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Own your data"
              body="PostgreSQL, Docker, no lock-in. Your schedule lives on your infrastructure."
            />
            <Feature
              icon={<Sparkles className="h-4 w-4" />}
              title="Teams & round-robin"
              body="Distribute bookings fairly across your team with collective and round-robin events."
              lastInRow
              last
            />
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-6 py-6 text-[13px] text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2.5">
            <TideLogo small />
            <span>© {new Date().getFullYear()} Tidetime · MIT licensed</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/login" className="transition-colors hover:text-foreground">
              Log in
            </Link>
            <Link href="/signup" className="transition-colors hover:text-foreground">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
  first,
  last,
  lastInRow,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  first?: boolean;
  last?: boolean;
  lastInRow?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-3 bg-card p-6 transition-colors hover:bg-secondary/30 ${
        first ? "sm:rounded-tl-xl" : ""
      } ${last ? "sm:rounded-br-xl" : ""} ${lastInRow ? "sm:rounded-tr-xl lg:rounded-none" : ""}`}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-secondary text-foreground">
        {icon}
      </div>
      <div>
        <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function TideLogo({ small }: { small?: boolean }) {
  const size = small ? 22 : 28;
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md bg-brand text-brand-foreground shadow-sm"
      style={{ width: size, height: size }}
    >
      <svg
        width={small ? 12 : 15}
        height={small ? 9 : 11}
        viewBox="0 0 15 11"
        fill="none"
        aria-hidden
      >
        <path
          d="M1 8.5C2.5 6.167 4 6.167 5.5 8.5S8.5 10.833 10 8.5s3-2.333 4.5 0"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M1 3.5C2.5 1.167 4 1.167 5.5 3.5S8.5 5.833 10 3.5s3-2.333 4.5 0"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
