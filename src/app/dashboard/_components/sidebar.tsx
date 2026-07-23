"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Clock,
  Settings2,
  LayoutGrid,
  Users,
  CalendarRange,
  Zap,
  Building2,
  Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { can, canAny } from "@/lib/rbac";
import type { MembershipRole } from "@/db/schema";
import { UserMenu } from "./user-menu";

/**
 * Focused navigation for company services, providers and bookings.
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
      { href: "/dashboard/services", label: "Services", icon: Zap },
      { href: "/dashboard/availability", label: "Availability", icon: Clock },
      { href: "/dashboard/integrations", label: "Connections", icon: Plug },
    ],
  },
  {
    label: "Company",
    items: [
      { href: "/dashboard/team", label: "Team", icon: Users },
      { href: "/dashboard/providers", label: "Members", icon: Building2 },
    ],
  },
] as const;

const ADMIN_GROUP = {
  label: "Admin",
  items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings2 }],
} as const;


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

  // Filter nav groups based on role permissions
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => {
        if (item.href === "/dashboard/calendar" || item.href === "/dashboard/bookings") {
          return canAny(role, ["booking.own.view", "booking.all.view"]);
        }
        if (item.href === "/dashboard/customers") return can(role, "customer.all.view");
        if (item.href === "/dashboard/team") return can(role, "team.directory.view");
        if (item.href === "/dashboard/providers") {
          return canAny(role, ["member.invite", "member.remove", "member.role.assign"]);
        }
        if (item.href === "/dashboard/services") {
          return canAny(role, [
            "service.catalog.view",
            "service.catalog.manage",
            "service.assigned.view",
          ]);
        }
        if (item.href === "/dashboard/availability") {
          return can(role, "availability.own.manage");
        }
        if (item.href === "/dashboard/integrations") {
          return can(role, "connection.own.manage");
        }
        return true;
      })
      .map((item) =>
        item.href === "/dashboard/services" && role === "member"
          ? { ...item, label: "My services" }
          : item,
      ),
  })).filter((g) => g.items.length > 0);

  const showAdmin = user.isAdmin;

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
