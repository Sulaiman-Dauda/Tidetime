"use client";

import Link from "next/link";
import { ChevronsUpDown, LogOut, Monitor, Moon, Sun, UserCog } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Segmented } from "@/components/ui/segmented";
import { initials } from "@/lib/format";
import { logoutAction } from "@/app/(auth)/actions";

interface UserMenuProps {
  user: { name: string | null; username: string; email?: string; avatarUrl: string | null };
}

type Theme = "light" | "dark" | "system";

const THEMES = [
  { value: "light", label: <><Sun aria-hidden /><span className="sr-only">Light</span></> },
  { value: "dark", label: <><Moon aria-hidden /><span className="sr-only">Dark</span></> },
  { value: "system", label: <><Monitor aria-hidden /><span className="sr-only">System</span></> },
] as const;

/** Account row at the foot of the sidebar: profile, theme and sign out. */
export function UserMenu({ user }: UserMenuProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const name = user.name ?? user.username;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=open]:bg-foreground/5"
        >
          <Avatar className="size-8 rounded-lg">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
            <AvatarFallback className="rounded-lg">{initials(name)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium leading-5">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {user.email ?? `@${user.username}`}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56">
        <DropdownMenuItem asChild>
          <Link href="/dashboard/account" className="cursor-pointer">
            <UserCog />
            Profile settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="flex items-center justify-between gap-3 py-1 pl-2 pr-1">
          <DropdownMenuLabel className="p-0">Theme</DropdownMenuLabel>
          <Segmented<Theme>
            size="sm"
            aria-label="Theme"
            value={mounted ? ((theme as Theme | undefined) ?? "system") : "system"}
            onValueChange={setTheme}
            options={THEMES}
          />
        </div>

        <DropdownMenuSeparator />

        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full cursor-pointer">
              <LogOut />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
