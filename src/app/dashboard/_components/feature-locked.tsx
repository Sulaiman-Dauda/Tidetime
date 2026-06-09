import Link from "next/link";
import type { Route } from "next";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown in place of a business feature that the instance hasn't enabled yet.
 * Keeps the default product lean while making the capability one click away for
 * admins. Non-admins get a quiet "ask your admin" message instead of a toggle.
 */
export function FeatureLocked({
  title,
  description,
  isAdmin,
}: {
  title: string;
  description: string;
  isAdmin: boolean;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border/70 bg-card/50 px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
        <Lock className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {isAdmin ? (
        <Button asChild className="mt-5" size="sm">
          <Link href={"/dashboard/settings#features" as Route}>Enable in Settings</Link>
        </Button>
      ) : (
        <p className="mt-5 text-xs text-muted-foreground">
          Ask a workspace admin to enable this in Settings.
        </p>
      )}
    </div>
  );
}
