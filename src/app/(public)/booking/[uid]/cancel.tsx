"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cancelBookingAction, type BookActionState } from "../../actions";

export function CancelBooking({ uid }: { uid: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<BookActionState, FormData>(async (prev, fd) => {
    const res = await cancelBookingAction(prev, fd);
    if (res && !res.error) {
      setOpen(false);
      router.refresh();
    }
    return res;
  }, null);

  return (
    <>
      <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setOpen(true)}>
        Cancel
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="max-w-md">
          <form action={formAction} className="grid gap-5">
            <input type="hidden" name="uid" value={uid} />
            <DialogHeader>
              <DialogTitle>Cancel this booking?</DialogTitle>
              <DialogDescription>
                This can&apos;t be undone. Any reason you give is shared with the host.
              </DialogDescription>
            </DialogHeader>
            <Field label="Reason (optional)" htmlFor="reason">
              <Textarea id="reason" name="reason" rows={3} placeholder="Let the host know why" />
            </Field>
            {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                Keep booking
              </Button>
              <Button type="submit" variant="destructive" loading={pending}>
                Cancel booking
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
