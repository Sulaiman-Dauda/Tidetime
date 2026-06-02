"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { submitReviewAction, type ReviewActionState } from "./actions";
import { Star, Loader2, CheckCircle2 } from "lucide-react";

export function ReviewForm({ uid }: { uid: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [done, setDone] = useState(false);
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(
    submitReviewAction,
    null,
  );

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      if (state.outcome.kind === "redirect") {
        window.location.href = state.outcome.url;
      } else {
        setDone(true);
      }
    }
  }, [state]);

  if (done) {
    return (
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        <p className="mt-4 text-sm text-muted-foreground">
          Thank you! Your feedback has been shared privately with the host.
        </p>
      </div>
    );
  }

  const active = hover || rating;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="uid" value={uid} />
      <input type="hidden" name="rating" value={rating} />

      <div className="flex justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className="transition-transform hover:scale-110"
          >
            <Star
              className="h-9 w-9"
              fill={n <= active ? "#f59e0b" : "none"}
              color={n <= active ? "#f59e0b" : "#cbd5e1"}
            />
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="feedback" className="text-xs">
          Comments (optional)
        </Label>
        <Textarea id="feedback" name="feedback" rows={3} placeholder="Tell us more…" />
      </div>

      {state && "error" in state ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending || rating === 0}>
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Submit review
      </Button>
    </form>
  );
}
