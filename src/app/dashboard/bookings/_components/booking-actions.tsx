"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarX2, Check, MoreHorizontal, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { cancelByHostAction, decideBookingAction } from "../actions";

type DecisionVariant = "default" | "outline" | "ghost";

function DecisionButton({
  uid,
  decision,
  variant,
  className,
}: {
  uid: string;
  decision: "accepted" | "rejected";
  variant: DecisionVariant;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <form
      className={className}
      action={async (formData) => {
        start(async () => {
          await decideBookingAction(formData);
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="uid" value={uid} />
      <input type="hidden" name="decision" value={decision} />
      <Button type="submit" variant={variant} size="sm" loading={pending} className="w-full">
        {decision === "accepted" ? <Check /> : <X />}
        {decision === "accepted" ? "Accept" : "Decline"}
      </Button>
    </form>
  );
}

export function AcceptButton({
  uid,
  variant = "default",
  className,
}: {
  uid: string;
  variant?: DecisionVariant;
  className?: string;
}) {
  return <DecisionButton uid={uid} decision="accepted" variant={variant} className={className} />;
}

export function DeclineButton({
  uid,
  variant = "outline",
  className,
}: {
  uid: string;
  variant?: DecisionVariant;
  className?: string;
}) {
  return <DecisionButton uid={uid} decision="rejected" variant={variant} className={className} />;
}

/** The confirm step for cancelling, shared by the booking page button and the row menu. */
function CancelBookingDialogContent({ uid, onDone }: { uid: string; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
        <AlertDialogDescription>
          The attendee will be notified and this time slot will become available again.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep booking</AlertDialogCancel>
        <form
          action={async (formData) => {
            start(async () => {
              await cancelByHostAction(formData);
              onDone();
              router.refresh();
            });
          }}
        >
          <input type="hidden" name="uid" value={uid} />
          <AlertDialogAction
            type="submit"
            className={buttonVariants({ variant: "destructive" })}
            disabled={pending}
          >
            {pending ? "Cancelling…" : "Cancel booking"}
          </AlertDialogAction>
        </form>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

export function CancelBookingButton({ uid, className }: { uid: string; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("text-destructive hover:text-destructive", className)}
        >
          <CalendarX2 />
          Cancel booking
        </Button>
      </AlertDialogTrigger>
      <CancelBookingDialogContent uid={uid} onDone={() => setOpen(false)} />
    </AlertDialog>
  );
}

/**
 * Overflow menu for an upcoming booking row. The confirm dialog is a sibling of
 * the menu, not a child: a Radix menu unmounts its items on close, which would
 * take a nested dialog with it.
 */
export function BookingRowMenu({
  uid,
  title,
  rescheduleHref,
}: {
  uid: string;
  title: string;
  rescheduleHref: string | null;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${title}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {rescheduleHref ? (
            <>
              <DropdownMenuItem asChild>
                <Link href={rescheduleHref as Route}>
                  <CalendarClock />
                  Reschedule
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive-subtle focus:text-destructive [&_svg]:text-destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            <CalendarX2 />
            Cancel booking
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <CancelBookingDialogContent uid={uid} onDone={() => setConfirmOpen(false)} />
      </AlertDialog>
    </>
  );
}
