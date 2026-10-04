import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { env } from "@/lib/env";
import { getAppUrl } from "@/server/app-url";
import "./globals.css";

// Geist (SIL Open Font License 1.1, see public/fonts/Geist-OFL.txt): one
// variable file covers every weight the UI uses. The previous ITF fonts were
// removed because their licence forbids redistribution in a public repository.
const geist = localFont({
  src: [{ path: "../../public/fonts/Geist-Variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-sans",
  display: "swap",
});

const description = "Book company services with the right available provider.";

export async function generateMetadata(): Promise<Metadata> {
  const appUrl = await getAppUrl();
  return {
  applicationName: env.appName,
  title: {
    default: `Book a service · ${env.appName}`,
    template: `%s · ${env.appName}`,
  },
  description,
  metadataBase: new URL(appUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: appUrl,
    siteName: env.appName,
    title: `Book a service · ${env.appName}`,
    description,
  },
  twitter: {
    card: "summary",
    title: `Book a service · ${env.appName}`,
    description,
  },
  icons: {
    icon: "/icon.svg",
  },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Set by src/proxy.ts; next-themes needs it on its inline theme script now
  // that the CSP no longer allows un-nonced inline scripts.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
