"use client";

import Link from "next/link";
import { Moon, Sun, LogOut, UserCog, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/format";
import { logoutAction } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  user: { name: string | null; username: string; email?: string; avatarUrl: string | null };
  /** "bar" = compact avatar button (top bar). "panel" = full-width row (sidebar). */
  variant?: "bar" | "panel";
}

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function UserMenu({ user, variant = "bar" }: UserMenuProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const name = user.name ?? user.username;
  const avatar = (
    <Avatar className="h-7 w-7 shrink-0 ring-2 ring-primary/30 ring-offset-1 ring-offset-background">
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
      <AvatarFallback className="bg-primary/15 text-[11px] font-semibold text-primary">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "panel" ? (
          <button
            type="button"
            aria-label="Account menu"
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-secondary/60"
          >
            {avatar}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium leading-none">{name}</span>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                @{user.username}
              </span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            aria-label="Account menu"
            className="rounded-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {avatar}
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-2.5 px-2 py-2">
          {avatar}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight">{name}</p>
            {user.email ? (
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            ) : (
              <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
            )}
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/dashboard/account" className="cursor-pointer">
            <UserCog className="h-4 w-4 text-muted-foreground" />
            Profile settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="px-2 py-1.5">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Theme
          </p>
          <div className="grid grid-cols-3 gap-1">
            {THEMES.map((t) => {
              const Icon = t.icon;
              const active = mounted && theme === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTheme(t.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md border px-2 py-1.5 text-[11px] transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <DropdownMenuSeparator />

        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
