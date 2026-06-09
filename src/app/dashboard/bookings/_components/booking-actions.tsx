"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { cancelByHostAction, decideBookingAction } from "../actions";
import { Check, X } from "lucide-react";

export function AcceptButton({ uid }: { uid: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <form
      action={async (formData) => {
        start(async () => {
          await decideBookingAction(formData);
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="uid" value={uid} />
      <input type="hidden" name="decision" value="accepted" />
      <Button type="submit" size="sm" loading={pending}>
        <Check className="h-3.5 w-3.5" />
        Accept
      </Button>
    </form>
  );
}

export function DeclineButton({ uid }: { uid: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <form
      action={async (formData) => {
        start(async () => {
          await decideBookingAction(formData);
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="uid" value={uid} />
      <input type="hidden" name="decision" value="rejected" />
      <Button type="submit" variant="outline" size="sm" loading={pending}>
        <X className="h-3.5 w-3.5" />
        Decline
      </Button>
    </form>
  );
}

export function CancelBookingButton({ uid }: { uid: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
        >
          Cancel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            The attendee will be notified and this time slot will become available again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form
            action={async (formData) => {
              start(async () => {
                await cancelByHostAction(formData);
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <input type="hidden" name="uid" value={uid} />
            <AlertDialogAction
              type="submit"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/88"
              disabled={pending}
            >
              {pending ? "Cancelling…" : "Cancel booking"}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
