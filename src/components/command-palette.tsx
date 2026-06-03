"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  LayoutGrid,
  CalendarDays,
  CalendarRange,
  Clock,
  LinkIcon,
  Box,
  BarChart3,
  Star,
  Users,
  Building2,
  Plug2,
  Settings2,
  UserCog,
  Tags,
  CalendarOff,
  Search,
  Zap,
} from "lucide-react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

const PAGES = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid, group: "Main" },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarRange, group: "Main" },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarDays, group: "Main" },
  { href: "/dashboard/customers", label: "Customers", icon: Users, group: "Main" },
  { href: "/dashboard/event-types", label: "Services", icon: Zap, group: "Catalog" },
  { href: "/dashboard/categories", label: "Categories", icon: Tags, group: "Catalog" },
  { href: "/dashboard/availability", label: "Availability", icon: Clock, group: "Catalog" },
  { href: "/dashboard/resources", label: "Resources", icon: Box, group: "Catalog" },
  { href: "/dashboard/links", label: "Booking Links", icon: LinkIcon, group: "Catalog" },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, group: "Grow" },
  { href: "/dashboard/reviews", label: "Reviews", icon: Star, group: "Grow" },
  { href: "/dashboard/teams", label: "Teams", icon: Building2, group: "Grow" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings2, group: "Admin" },
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug2, group: "Admin" },
  { href: "/dashboard/blocked-periods", label: "Blocked Periods", icon: CalendarOff, group: "Admin" },
  { href: "/dashboard/account", label: "Profile settings", icon: UserCog, group: "Account" },
];

export function CommandPalette({
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);

  // Use external control if provided, otherwise internal state
  const open = externalOpen ?? internalOpen;
  const setOpen = externalOnOpenChange ?? setInternalOpen;

  const down = useCallback((e: KeyboardEvent) => {
    if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setOpen(!open);
    }
  }, [open, setOpen]);

  useEffect(() => {
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [down]);

  const groups = [...new Set(PAGES.map((p) => p.group))];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-lg sm:max-w-lg [&>button]:hidden">
        <DialogTitle className="sr-only">Search pages</DialogTitle>
        <Command>
          <CommandInput placeholder="Search pages..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group} heading={group}>
                {PAGES.filter((p) => p.group === group).map((page) => (
                  <CommandItem
                    key={page.href}
                    value={page.label}
                    onSelect={() => {
                      router.push(page.href as Route);
                      setOpen(false);
                    }}
                  >
                    <page.icon className="h-4 w-4 text-muted-foreground" />
                    {page.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          <div className="flex items-center gap-2 border-t border-border px-4 py-2">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Search className="h-3 w-3" />
              Type a command or search
            </span>
            <CommandShortcut>⌘K</CommandShortcut>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
