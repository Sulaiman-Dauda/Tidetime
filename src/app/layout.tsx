import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { env } from "@/lib/env";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

const description =
  "Tidetime is a fast, elegant, open-source scheduling platform. Share your link, let people book — no back-and-forth.";

export const metadata: Metadata = {
  applicationName: env.appName,
  title: {
    default: `${env.appName} — Scheduling, perfected`,
    template: `%s · ${env.appName}`,
  },
  description,
  metadataBase: new URL(env.appUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: env.appUrl,
    siteName: env.appName,
    title: `${env.appName} — Scheduling, perfected`,
    description,
  },
  twitter: {
    card: "summary",
    title: `${env.appName} — Scheduling, perfected`,
    description,
  },
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${mono.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
