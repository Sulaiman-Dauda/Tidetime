"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  CalendarDays,
  Clock,
  Contact,
  Layers,
  LayoutDashboard,
  Plug,
  Settings,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { can, canAny } from "@/lib/rbac";
import type { MembershipRole } from "@/db/schema";
import { WaveMark } from "@/components/wave-mark";
import { UserMenu } from "./user-menu";
import { SidebarUpdate } from "./sidebar-update";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: readonly NavItem[] };

const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck },
      { href: "/dashboard/customers", label: "Customers", icon: Contact },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/dashboard/services", label: "Services", icon: Layers },
      { href: "/dashboard/availability", label: "Availability", icon: Clock },
      { href: "/dashboard/integrations", label: "Connections", icon: Plug },
    ],
  },
  {
    label: "Company",
    items: [
      { href: "/dashboard/team", label: "Team", icon: Users },
      { href: "/dashboard/providers", label: "Members", icon: UserCog },
    ],
  },
];

const ADMIN_GROUP: NavGroup = {
  label: "Admin",
  items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings }],
};

interface SidebarProps {
  user: {
    name: string | null;
    username: string;
    email: string;
    avatarUrl: string | null;
    isAdmin: boolean;
    role: string;
  };
  onNavigate?: () => void;
}

function canSee(role: MembershipRole, href: string): boolean {
  switch (href) {
    case "/dashboard/calendar":
    case "/dashboard/bookings":
      return canAny(role, ["booking.own.view", "booking.all.view"]);
    case "/dashboard/customers":
      return can(role, "customer.all.view");
    case "/dashboard/team":
      return can(role, "team.directory.view");
    case "/dashboard/providers":
      return canAny(role, ["member.invite", "member.remove", "member.role.assign"]);
    case "/dashboard/services":
      return canAny(role, [
        "service.catalog.view",
        "service.catalog.manage",
        "service.assigned.view",
      ]);
    case "/dashboard/availability":
      return can(role, "availability.own.manage");
    case "/dashboard/integrations":
      return can(role, "connection.own.manage");
    default:
      return true;
  }
}

export function SidebarContent({ user, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const role = user.role as MembershipRole;

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  const groups = [...NAV_GROUPS, ...(user.isAdmin ? [ADMIN_GROUP] : [])]
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => canSee(role, item.href))
        .map((item) =>
          item.href === "/dashboard/services" && role === "member"
            ? { ...item, label: "My services" }
            : item,
        ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-4">
        <WaveMark size={26} />
        <span className="text-base font-semibold tracking-tight text-foreground">
          Tidetime
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-3 pt-1">
        {groups.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">{group.label}</div>
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href as Route}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                    active
                      ? "bg-background font-medium text-foreground shadow-xs ring-1 ring-border"
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                    )}
                  />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {user.isAdmin ? <SidebarUpdate /> : null}

      <div className="shrink-0 p-3 pt-1">
        <UserMenu
          user={{ name: user.name, username: user.username, email: user.email, avatarUrl: user.avatarUrl }}
        />
      </div>
    </div>
  );
}
