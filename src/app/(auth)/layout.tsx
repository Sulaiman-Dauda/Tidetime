import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, hasAnyUser } from "@/lib/auth";
import { AuthIntro } from "./_components/auth-motion";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasAnyUser())) redirect("/setup");
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen bg-background">
      <AuthIntro />

      {/* Dot grid background */}
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-40" aria-hidden />

      {/* Left brand rail — visible on lg+ */}
      <div className="relative hidden w-[440px] shrink-0 flex-col justify-between overflow-hidden border-r border-border bg-card/60 p-12 lg:flex xl:w-[520px]">
        {/* Soft brand glow for depth */}
        <div
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <Link
          href="/"
          className="relative flex items-center gap-2.5"
          style={{ animation: "tt-rise 0.5s cubic-bezier(0.22,1,0.36,1) both" }}
        >
          <TideLogo />
          <span className="text-base font-semibold tracking-[-0.01em] text-foreground">
            Tidetime
          </span>
        </Link>

        <div className="relative space-y-9">
          <blockquote className="space-y-4" style={{ animation: "tt-rise 0.6s cubic-bezier(0.22,1,0.36,1) 0.05s both" }}>
            <p className="text-[30px] font-semibold leading-[1.12] tracking-tight text-foreground xl:text-[34px]">
              &ldquo;One link.<br />Infinite time back.&rdquo;
            </p>
            <p className="max-w-sm text-[15px] leading-relaxed text-muted-foreground">
              Share your booking page and let the right people find the right time — automatically.
            </p>
          </blockquote>

          <ul className="space-y-3.5 text-[15px] text-muted-foreground" style={{ animation: "tt-rise 0.6s cubic-bezier(0.22,1,0.36,1) 0.12s both" }}>
            {[
              "Timezone-aware scheduling",
              "Services with assigned providers",
              "Signed Zapier webhooks",
              "Open-source, self-hostable",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground/60">
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
