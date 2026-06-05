import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, hasAnyUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasAnyUser())) redirect("/setup");
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen bg-background">
      {/* Dot grid background */}
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-40" aria-hidden />

      {/* Left brand rail — visible on lg+ */}
      <div className="relative hidden w-[420px] shrink-0 flex-col justify-between border-r border-border bg-card/60 p-10 lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <TideLogo />
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            Tidetime
          </span>
        </Link>

        <div className="space-y-6">
          <blockquote className="space-y-3">
            <p className="text-[22px] font-semibold leading-snug tracking-tight text-foreground">
              &ldquo;One link.<br />Infinite time back.&rdquo;
            </p>
            <p className="text-sm text-muted-foreground">
              Share your booking page and let the right people find the right time — automatically.
            </p>
          </blockquote>

          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {[
              "Timezone-aware scheduling",
              "Paid events with Stripe",
              "Team round-robin & collective",
              "Open-source, self-hostable",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} Tidetime · MIT licensed
        </p>
      </div>

      {/* Right: form area */}
      <div className="relative flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex h-14 items-center px-6 lg:hidden">
          <Link href="/" className="flex items-center gap-2.5">
            <TideLogo />
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
              Tidetime
            </span>
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 py-12">
          {children}
        </main>
      </div>
    </div>
  );
}

function TideLogo() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
      <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden>
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
