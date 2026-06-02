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
  Plug2,
  Settings2,
  CalendarOff,
  Search,
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
} from "@/components/ui/dialog";

const PAGES = [
  { href: "/dashboard", label: "Event Types", icon: LayoutGrid, group: "Main" },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarDays, group: "Main" },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarRange, group: "Main" },
  { href: "/dashboard/availability", label: "Availability", icon: Clock, group: "Manage" },
  { href: "/dashboard/links", label: "Booking Links", icon: LinkIcon, group: "Manage" },
  { href: "/dashboard/resources", label: "Resources", icon: Box, group: "Manage" },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, group: "Insights" },
  { href: "/dashboard/reviews", label: "Reviews", icon: Star, group: "Insights" },
  { href: "/dashboard/teams", label: "Teams", icon: Users, group: "Admin" },
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug2, group: "Admin" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings2, group: "Admin" },
  { href: "/dashboard/blocked-periods", label: "Blocked Periods", icon: CalendarOff, group: "Admin" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const down = useCallback((e: KeyboardEvent) => {
    if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setOpen((open) => !open);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [down]);

  const groups = [...new Set(PAGES.map((p) => p.group))];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-lg sm:max-w-lg [&>button]:hidden">
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
