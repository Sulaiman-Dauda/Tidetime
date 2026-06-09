"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Clock,
  LinkIcon,
  Settings2,
  LayoutGrid,
  Users,
  BarChart3,
  Star,
  CalendarOff,
  CalendarRange,
  Zap,
  Building2,
  Tags,
  Workflow,
  Vote,
  Plug,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { can } from "@/lib/rbac";
import type { MembershipRole } from "@/db/schema";
import { UserMenu } from "./user-menu";

/**
 * Sidebar is split into an always-visible core (everything a Calendly switcher
 * needs in week one) and a collapsed-by-default "Advanced" section holding the
 * power features (routing forms, polls, booking links, categories).
 * This is the deliberate TRIM: keep capability, but don't let an 18-item menu
 * bury the 5-minute setup. The open/closed state is remembered per browser.
 */

const NAV_GROUPS = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutGrid },
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarRange },
      { href: "/dashboard/bookings", label: "Bookings", icon: CalendarDays },
      { href: "/dashboard/customers", label: "Customers", icon: Users },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/dashboard/event-types", label: "Services", icon: Zap },
      { href: "/dashboard/availability", label: "Availability", icon: Clock },
    ],
  },
  {
    label: "Grow",
    items: [
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/dashboard/reviews", label: "Reviews", icon: Star },
      { href: "/dashboard/teams", label: "Teams", icon: Building2 },
    ],
  },
] as const;

/** Power features — collapsed by default so the default surface stays lean. */
const ADVANCED_GROUP = {
  label: "Advanced",
  items: [
    { href: "/dashboard/categories", label: "Categories", icon: Tags },
    { href: "/dashboard/links", label: "Booking Links", icon: LinkIcon },
    { href: "/dashboard/routing", label: "Routing Forms", icon: Workflow },
    { href: "/dashboard/polls", label: "Meeting Polls", icon: Vote },
  ],
} as const;

const ADMIN_GROUP = {
  label: "Admin",
  items: [
    { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
    { href: "/dashboard/settings", label: "Settings", icon: Settings2 },
    { href: "/dashboard/blocked-periods", label: "Blocked Periods", icon: CalendarOff },
  ],
} as const;

const ADVANCED_HREFS = ADVANCED_GROUP.items.map((i) => i.href) as readonly string[];
const ADV_STORAGE_KEY = "tt-advanced-open";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

interface SidebarProps {
  user: { name: string | null; username: string; email: string; avatarUrl: string | null; isAdmin: boolean; role: string };
  onNavigate?: () => void;
}

export function SidebarContent({ user, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const role = user.role as MembershipRole;

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  // Advanced section: collapsed by default, but auto-expanded when you're on one
  // of its pages, and persisted once the user toggles it.
  const onAdvancedPage = ADVANCED_HREFS.some((h) => pathname.startsWith(h));
  const [advancedOpen, setAdvancedOpen] = useState(onAdvancedPage);
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(ADV_STORAGE_KEY) : null;
    if (stored === "1") setAdvancedOpen(true);
  }, []);
  useEffect(() => {
    if (onAdvancedPage) setAdvancedOpen(true);
  }, [onAdvancedPage]);
  function toggleAdvanced() {
    setAdvancedOpen((v) => {
      const next = !v;
      if (typeof window !== "undefined") window.localStorage.setItem(ADV_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  // Filter nav groups based on role permissions
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.href === "/dashboard/analytics") return can(role, "analytics.view");
      if (item.href === "/dashboard/teams") return can(role, "team.view");
      if (item.href === "/dashboard/availability") return can(role, "availability.manage");
      return true;
    }),
  })).filter((g) => g.items.length > 0);

  const showAdmin = user.isAdmin || can(role, "team.manage");

  function NavLink({ href, label, icon: Icon }: NavItem) {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href as Route}
        onClick={onNavigate}
        className={cn(
          "group flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13.5px] transition-all duration-150",
          active
            ? "bg-primary text-primary-foreground font-semibold shadow-sm"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground font-[450]",
        )}
      >
        <Icon
          className={cn(
            "h-[15px] w-[15px] shrink-0 transition-colors",
            active ? "text-primary-foreground" : "text-muted-foreground/70 group-hover:text-foreground",
          )}
        />
        <span className="flex-1">{label}</span>
      </Link>
    );
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
        {visibleGroups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="mx-2 my-1 border-t border-sidebar-border/60" />}
            <div className="px-3 pt-2.5 pb-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                {group.label}
              </span>
            </div>
            <div className="space-y-0.5 py-0.5">
              {(group.items as readonly NavItem[]).map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          </div>
        ))}

        {/* Advanced — collapsible */}
        <div>
          <div className="mx-2 my-1 border-t border-sidebar-border/60" />
          <button
            type="button"
            onClick={toggleAdvanced}
            aria-expanded={advancedOpen}
            className="flex w-full items-center justify-between px-3 pt-2.5 pb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 transition-colors hover:text-muted-foreground"
          >
            {ADVANCED_GROUP.label}
            <ChevronDown
              className={cn("h-3 w-3 transition-transform duration-200", advancedOpen ? "" : "-rotate-90")}
            />
          </button>
          {advancedOpen ? (
            <div className="space-y-0.5 py-0.5">
              {(ADVANCED_GROUP.items as readonly NavItem[]).map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          ) : null}
        </div>

        {/* Admin */}
        {showAdmin ? (
          <div>
            <div className="mx-2 my-1 border-t border-sidebar-border/60" />
            <div className="px-3 pt-2.5 pb-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                {ADMIN_GROUP.label}
              </span>
            </div>
            <div className="space-y-0.5 py-0.5">
              {(ADMIN_GROUP.items as readonly NavItem[]).map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          </div>
        ) : null}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border/60 p-2">
        <UserMenu
          variant="panel"
          user={{ name: user.name, username: user.username, email: user.email, avatarUrl: user.avatarUrl }}
        />
      </div>
    </div>
  );
}

export function Sidebar({ user }: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col bg-sidebar border-r border-sidebar-border md:flex">
      <SidebarContent user={user} />
    </aside>
  );
}

function TideLogo() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
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
