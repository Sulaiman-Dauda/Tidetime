"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarContent } from "./sidebar";
import { RouteProgress } from "./route-progress";

const SECTION_LABELS: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/services": "Services",
  "/dashboard/bookings": "Bookings",
  "/dashboard/customers": "Customers",
  "/dashboard/calendar": "Calendar",
  "/dashboard/availability": "Availability",
  "/dashboard/providers": "Members",
  "/dashboard/team": "Team",
  "/dashboard/integrations": "Connections",
  "/dashboard/account": "Profile settings",
  "/dashboard/settings": "Settings",
};

type User = {
  name: string | null;
  username: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  role: string;
};

/** The section a path belongs to: its own entry, or the nearest parent's. */
function sectionFor(pathname: string): { href: string; label: string } | null {
  const segments = pathname.split("/").filter(Boolean);
  for (let i = segments.length; i > 0; i--) {
    const href = "/" + segments.slice(0, i).join("/");
    if (SECTION_LABELS[href]) return { href, label: SECTION_LABELS[href] };
  }
  return null;
}

/*
 * Layout: the sidebar sits on the canvas colour and the page content lives in
 * an inset panel beside it. From md up the panel scrolls on its own, so the
 * sidebar and header stay put; on phones the window scrolls and the header
 * sticks.
 */
export function DashboardShell({
  user,
  children,
  copyLinkEl,
}: {
  user: User;
  children: React.ReactNode;
  copyLinkEl: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const section = sectionFor(pathname);
  const nested = section !== null && section.href !== pathname;

  return (
    <TooltipProvider delayDuration={300}>
      <RouteProgress />
      <div className="flex min-h-dvh bg-canvas md:h-dvh md:overflow-hidden">
        <aside className="hidden w-60 shrink-0 flex-col md:flex">
          <SidebarContent user={user} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col md:p-2 md:pl-0">
          <div className="flex min-h-0 flex-1 flex-col bg-background md:overflow-hidden md:rounded-xl md:border md:shadow-xs">
            <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur md:px-6">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="md:hidden">
                    <PanelLeft />
                    <span className="sr-only">Open navigation</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 bg-canvas p-0">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <SidebarContent user={user} onNavigate={() => setMobileOpen(false)} />
                </SheetContent>
              </Sheet>

              <div className="min-w-0 flex-1 truncate text-sm font-medium">
                {section && nested ? (
                  <Link
                    href={section.href as Route}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {section.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{section?.label ?? "Tidetime"}</span>
                )}
              </div>

              <div className="min-w-0 shrink">{copyLinkEl}</div>
            </header>

            <main className="min-h-0 flex-1 md:overflow-y-auto">
              <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
