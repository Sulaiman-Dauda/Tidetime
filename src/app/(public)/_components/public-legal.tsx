import Link from "next/link";
import type { Route } from "next";
import { getCompanySettings } from "@/server/company-settings";
import { CookieBanner } from "./cookie-banner";

/**
 * Public footer + cookie notice driven by the company's Legal Contents
 * settings. Renders nothing extra when no legal links are configured.
 */
export async function PublicLegal() {
  const { legal } = await getCompanySettings();

  const links: { label: string; href: string; external: boolean }[] = [];
  if (legal.termsEnabled && legal.termsContent.trim()) {
    links.push({ label: "Terms & Conditions", href: "/legal/terms", external: false });
  }
  if (legal.privacyEnabled && legal.privacyContent.trim()) {
    links.push({ label: "Privacy Policy", href: "/legal/privacy", external: false });
  }
  if (legal.imprintUrl.trim()) {
    links.push({ label: "Imprint", href: legal.imprintUrl, external: true });
  }
  if (legal.legalNoticeUrl.trim()) {
    links.push({ label: "Legal Notice", href: legal.legalNoticeUrl, external: true });
  }

  const showBanner = legal.cookieNoticeEnabled && legal.cookieNoticeContent.trim().length > 0;

  if (links.length === 0 && !showBanner) return null;

  return (
    <>
      {links.length > 0 ? (
        <nav className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 pb-10 text-xs text-muted-foreground">
          {links.map((l) =>
            l.external ? (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground hover:underline"
              >
                {l.label}
              </a>
            ) : (
              <Link key={l.label} href={l.href as Route} className="hover:text-foreground hover:underline">
                {l.label}
              </Link>
            ),
          )}
        </nav>
      ) : null}
      {showBanner ? <CookieBanner content={legal.cookieNoticeContent} /> : null}
    </>
  );
}
