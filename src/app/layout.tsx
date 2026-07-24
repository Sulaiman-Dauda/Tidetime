import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { env } from "@/lib/env";
import { getAppUrl } from "@/server/app-url";
import "./globals.css";

const clashDisplay = localFont({
  src: [
    { path: "../../public/fonts/ClashDisplay-Regular.woff2", weight: "400" },
    { path: "../../public/fonts/ClashDisplay-Medium.woff2", weight: "500" },
    { path: "../../public/fonts/ClashDisplay-SemiBold.woff2", weight: "600" },
    { path: "../../public/fonts/ClashDisplay-Bold.woff2", weight: "700" },
  ],
  variable: "--font-serif",
  display: "swap",
});

const satoshi = localFont({
  src: [
    { path: "../../public/fonts/Satoshi-Regular.woff2", weight: "400" },
    { path: "../../public/fonts/Satoshi-Medium.woff2", weight: "500" },
    { path: "../../public/fonts/Satoshi-Bold.woff2", weight: "700" },
  ],
  variable: "--font-sans",
  display: "swap",
});

const description = "Book company services with the right available provider.";

export async function generateMetadata(): Promise<Metadata> {
  const appUrl = await getAppUrl();
  return {
  applicationName: env.appName,
  title: {
    default: `${env.appName} — Book a service`,
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
    title: `${env.appName} — Book a service`,
    description,
  },
  twitter: {
    card: "summary",
    title: `${env.appName} — Book a service`,
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
      <body className={`${clashDisplay.variable} ${satoshi.variable} font-sans`}>
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
