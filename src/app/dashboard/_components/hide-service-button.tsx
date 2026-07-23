"use client";

import { useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toggleHiddenAction } from "../services/actions";

/**
 * Show/hide a service on the public booking page. Hiding a live service asks
 * for confirmation (it takes effect immediately); showing is instant.
 */
export function HideServiceButton({ id, hidden, title }: { id: number; hidden: boolean; title: string }) {
  const [pending, start] = useTransition();

  function toggle() {
    const data = new FormData();
    data.set("id", String(id));
    data.set("hidden", String(hidden));
    start(async () => {
      await toggleHiddenAction(data);
    });
  }

  const buttonClass =
    "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50";

  if (hidden) {
    return (
      <button type="button" title="Show on booking page" className={buttonClass} onClick={toggle} disabled={pending}>
        <Eye className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button type="button" title="Hide from booking page" className={buttonClass} disabled={pending}>
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hide “{title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            It disappears from the public booking page immediately. Existing bookings are not
            affected, and you can show it again at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={toggle}>Hide service</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
