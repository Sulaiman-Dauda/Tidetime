"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  deleteServiceAction,
  duplicateServiceAction,
  reorderServicesAction,
  toggleHiddenAction,
} from "../services/actions";

/**
 * Row actions for a service.
 *
 * These used to be five bare icon buttons in a row — including an unguarded
 * delete as the first one — which gave no clue what any of them did. Everything
 * secondary now lives behind one overflow menu with written labels, and delete
 * is separated at the bottom in destructive styling.
 *
 * The confirm dialogs are siblings of the menu rather than children: a Radix
 * menu unmounts its items on close, which would take a nested dialog with it.
 */
export function ServiceRowActions({
  id,
  title,
  hidden,
  canMoveUp,
  canMoveDown,
}: {
  id: number;
  title: string;
  hidden: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<null | "delete" | "hide">(null);

  function run(action: (data: FormData) => Promise<unknown>, fields: Record<string, string>) {
    const data = new FormData();
    data.set("id", String(id));
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    start(async () => {
      await action(data);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            disabled={pending}
            aria-label={`More actions for ${title}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={!canMoveUp || pending}
            onSelect={() => run(reorderServicesAction, { direction: "up" })}
          >
            <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canMoveDown || pending}
            onSelect={() => run(reorderServicesAction, { direction: "down" })}
          >
            <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
            Move down
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            disabled={pending}
            onSelect={() => run(duplicateServiceAction, {})}
          >
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pending}
            onSelect={() => {
              // Showing a service is harmless and instant; hiding a live one
              // takes effect on the public page, so it asks first.
              // The action reads `hidden` as the *current* state and flips it.
              if (hidden) run(toggleHiddenAction, { hidden: String(hidden) });
              else setConfirm("hide");
            }}
          >
            {hidden ? (
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {hidden ? "Show on booking page" : "Hide from booking page"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            disabled={pending}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            onSelect={() => setConfirm("delete")}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete service
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm === "hide"} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hide &ldquo;{title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the public booking page immediately. Existing bookings are not
              affected, and you can show it again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => run(toggleHiddenAction, { hidden: String(hidden) })}>
              Hide service
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "delete"} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes this service and all its settings. Any existing bookings
              remain unaffected but no new bookings can be made.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/88"
              disabled={pending}
              onClick={() => run(deleteServiceAction, {})}
            >
              {pending ? "Deleting…" : "Delete service"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
