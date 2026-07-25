"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar, SidebarContent } from "./sidebar";
import { UserMenu } from "./user-menu";
import { RouteProgress } from "./route-progress";

const BREADCRUMB_LABELS: Record<string, string> = {
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

  function getBreadcrumb() {
    if (BREADCRUMB_LABELS[pathname]) return BREADCRUMB_LABELS[pathname];
    const segments = pathname.split("/").filter(Boolean);
    for (let i = segments.length; i > 0; i--) {
      const prefix = "/" + segments.slice(0, i).join("/");
      if (BREADCRUMB_LABELS[prefix]) return BREADCRUMB_LABELS[prefix];
    }
    return null;
  }

  const breadcrumb = getBreadcrumb();

  return (
    <TooltipProvider delayDuration={300}>
      <RouteProgress />
      <div className="flex min-h-screen bg-background">
        {/* Desktop Sidebar */}
        <Sidebar user={user} />

        {/* Main area. The mobile header lives inside this column — as a sibling
            of the sidebar it would be laid out as a second row-flex column and
            push the content off-screen on phones. */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile header */}
          <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/90 px-4 backdrop-blur-sm md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-[18px] w-[18px]" />
                  <span className="sr-only">Open navigation</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SidebarContent user={user} onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            {breadcrumb ? (
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.01em]">
                {breadcrumb}
              </span>
            ) : (
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.01em]">
                Tidetime
              </span>
            )}
            <span key="copy-mobile" className="min-w-0 shrink">
              {copyLinkEl}
            </span>
          </div>

          {/* Desktop top bar */}
          <header className="sticky top-0 z-20 hidden h-14 items-center gap-4 border-b border-border/60 bg-background/90 px-8 backdrop-blur-sm md:flex">
            {breadcrumb ? (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">Dashboard</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                <span className="font-medium text-foreground">{breadcrumb}</span>
              </div>
            ) : (
              <div />
            )}
            <div className="flex-1" />
            <span key="copy-desktop">{copyLinkEl}</span>
            <UserMenu user={user} />
          </header>

          {/* Content */}
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
