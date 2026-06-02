"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar, SidebarContent } from "./sidebar";
import { CommandPalette } from "@/components/command-palette";
import { initials } from "@/lib/format";

const BREADCRUMB_LABELS: Record<string, string> = {
  "/dashboard": "Event Types",
  "/dashboard/bookings": "Bookings",
  "/dashboard/calendar": "Calendar",
  "/dashboard/availability": "Availability",
  "/dashboard/links": "Booking Links",
  "/dashboard/resources": "Resources",
  "/dashboard/analytics": "Analytics",
  "/dashboard/reviews": "Reviews",
  "/dashboard/teams": "Teams",
  "/dashboard/integrations": "Integrations",
  "/dashboard/settings": "Settings",
  "/dashboard/blocked-periods": "Blocked Periods",
};

type User = {
  name: string | null;
  username: string;
  avatarUrl: string | null;
  isAdmin: boolean;
};

export function DashboardShell({
  user,
  children,
  copyLinkEl,
  pendingBookings = 0,
}: {
  user: User;
  children: React.ReactNode;
  copyLinkEl: React.ReactNode;
  pendingBookings?: number;
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

  function openCommand() {
    setMobileOpen(false);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  const breadcrumb = getBreadcrumb();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-screen bg-background">
        {/* Desktop Sidebar */}
        <Sidebar user={user} pendingBookings={pendingBookings} />

        {/* Mobile header */}
        <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/90 px-4 backdrop-blur-sm md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-[18px] w-[18px]" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[260px] p-0">
              <SidebarContent user={user} onNavigate={() => setMobileOpen(false)} pendingBookings={pendingBookings} />
            </SheetContent>
          </Sheet>
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Tidetime</span>
          <div className="flex-1" />
          {breadcrumb && (
            <span className="hidden text-sm font-medium text-foreground sm:block">{breadcrumb}</span>
          )}
          <div className="flex-1 sm:hidden" />
          {copyLinkEl}
          <Tooltip content="Search (⌘K)">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={openCommand}>
              <Search className="h-[17px] w-[17px]" />
            </Button>
          </Tooltip>
        </div>

        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col">
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
            {copyLinkEl}
            <Tooltip content={`Search pages (⌘K)`}>
              <button
                onClick={openCommand}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Search...</span>
                <kbd className="hidden rounded border border-border bg-secondary px-1 py-0 text-[10px] font-medium text-muted-foreground lg:inline-block">
                  ⌘K
                </kbd>
              </button>
            </Tooltip>
            <Tooltip content={user.name ?? user.username}>
              <Avatar className="h-7 w-7 ring-1 ring-border">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                <AvatarFallback className="text-[11px] font-medium">
                  {initials(user.name ?? user.username)}
                </AvatarFallback>
              </Avatar>
            </Tooltip>
          </header>

          {/* Content */}
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Command palette (⌘K) */}
      <CommandPalette />
    </TooltipProvider>
  );
}
