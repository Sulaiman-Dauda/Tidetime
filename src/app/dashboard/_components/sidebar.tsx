"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Clock,
  LinkIcon,
  Settings2,
  LayoutGrid,
  LogOut,
  Users,
  BarChart3,
  Box,
  Star,
  CalendarOff,
  CalendarRange,
  Plug2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { logoutAction } from "@/app/(auth)/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tooltip } from "@/components/ui/tooltip";

const NAV_GROUPS = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Event Types", icon: LayoutGrid },
      { href: "/dashboard/bookings", label: "Bookings", icon: CalendarDays },
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarRange },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/dashboard/availability", label: "Availability", icon: Clock },
      { href: "/dashboard/links", label: "Booking Links", icon: LinkIcon },
      { href: "/dashboard/resources", label: "Resources", icon: Box },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/dashboard/reviews", label: "Reviews", icon: Star },
      { href: "/dashboard/teams", label: "Teams", icon: Users },
      { href: "/dashboard/integrations", label: "Integrations", icon: Plug2 },
      { href: "/dashboard/settings", label: "Settings", icon: Settings2 },
    ],
  },
] as const;

const ADMIN_GROUP = {
  label: "Admin",
  items: [{ href: "/dashboard/blocked-periods", label: "Blocked Periods", icon: CalendarOff }],
} as const;

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

interface SidebarProps {
  user: { name: string | null; username: string; avatarUrl: string | null; isAdmin: boolean };
  onNavigate?: () => void;
  pendingBookings?: number;
}

export function SidebarContent({ user, onNavigate, pendingBookings = 0 }: SidebarProps) {
  const pathname = usePathname();
  const groups = user.isAdmin ? [...NAV_GROUPS, ADMIN_GROUP] : NAV_GROUPS;

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-5">
        <TideLogo />
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
          Tidetime
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0 overflow-y-auto px-2 pb-2">
        {groups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="mx-2 my-1 border-t border-sidebar-border/60" />}
            <div className="px-3 pt-2.5 pb-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                {group.label}
              </span>
            </div>
            <div className="space-y-0.5 py-0.5">
              {(group.items as readonly NavItem[]).map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href as Route}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13.5px] transition-colors",
                      active
                        ? "bg-accent text-brand font-medium"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground font-[450]",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[15px] w-[15px] shrink-0 transition-colors",
                        active
                          ? "text-brand"
                          : "text-muted-foreground/70 group-hover:text-foreground",
                      )}
                    />
                    <span className="flex-1">{label}</span>
                    {label === "Bookings" && pendingBookings > 0 && (
                      <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground">
                        {pendingBookings}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border/60 p-2">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
          <Avatar className="h-7 w-7 shrink-0 ring-1 ring-border">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
            <AvatarFallback className="text-[11px] font-medium">
              {initials(user.name ?? user.username)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-none">{user.name ?? user.username}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">@{user.username}</p>
          </div>
          <div className="flex items-center gap-0.5">
            <ThemeToggle />
            <form action={logoutAction}>
              <Tooltip content="Log out">
                <button
                  type="submit"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <LogOut className="h-[15px] w-[15px]" />
                </button>
              </Tooltip>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ user, pendingBookings = 0 }: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col bg-sidebar border-r border-sidebar-border md:flex">
      <SidebarContent user={user} pendingBookings={pendingBookings} />
    </aside>
  );
}

function TideLogo() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand text-brand-foreground shadow-sm">
      <svg
        width="15"
        height="11"
        viewBox="0 0 15 11"
        fill="none"
        aria-hidden="true"
      >
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
