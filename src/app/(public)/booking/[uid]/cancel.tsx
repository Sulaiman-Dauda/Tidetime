"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cancelBookingAction, type BookActionState } from "../../actions";
import { Loader2, XCircle } from "lucide-react";

export function CancelBooking({ uid, isRecurring = false }: { uid: string; isRecurring?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<BookActionState, FormData>(async (prev, fd) => {
    const res = await cancelBookingAction(prev, fd);
    if (res && !res.error) router.refresh();
    return res;
  }, null);

  if (!open) {
    return (
      <Button variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <XCircle className="h-4 w-4" /> Cancel
      </Button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-3">
      <input type="hidden" name="uid" value={uid} />
      <div className="space-y-1.5">
        <Label htmlFor="reason" className="text-xs">
          Reason (optional)
        </Label>
        <Textarea id="reason" name="reason" rows={2} placeholder="Let the host know why…" />
      </div>
      {isRecurring ? (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="series" className="h-4 w-4 rounded border-input" />
          Cancel all upcoming occurrences in this series
        </label>
      ) : null}
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
          Keep it
        </Button>
        <Button type="submit" variant="destructive" className="flex-1" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel booking"}
        </Button>
      </div>
    </form>
  );
}
