"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { InfoTip } from "@/components/ui/info-tip";
import { updateReviewSettingsAction, type ReviewSettingsState } from "./review-actions";

export interface ReviewSettingsView {
  reviewRequestsEnabled: boolean;
  googleReviewUrl: string | null;
  reviewThreshold: number;
}

export function ReviewSettings({ review }: { review: ReviewSettingsView }) {
  const { toast } = useToast();
  const [state, action, pending] = useActionState<ReviewSettingsState, FormData>(
    updateReviewSettingsAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) toast({ title: "Changes saved", description: "Your review settings have been updated." });
    if (state?.error)
      toast({
        title: "Couldn't save changes",
        description: state.error || "Please check your details and try again.",
        variant: "destructive",
      });
  }, [state, toast]);

  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold">Reviews</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Email attendees a feedback request after their booking. High ratings are sent to your
        public review page; lower ratings stay private.
      </p>
      <form action={action} className="mt-5 space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="reviewRequestsEnabled">Send review requests</Label>
          <Switch
            id="reviewRequestsEnabled"
            name="reviewRequestsEnabled"
            defaultChecked={review.reviewRequestsEnabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="googleReviewUrl">Public review URL</Label>
          <Input
            id="googleReviewUrl"
            name="googleReviewUrl"
            type="url"
            placeholder="https://g.page/r/…/review"
            defaultValue={review.googleReviewUrl ?? ""}
          />
          <p className="text-xs text-muted-foreground">
            Where happy attendees are redirected (e.g. your Google review link).
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>
            Minimum rating for public redirect{" "}
            <InfoTip>Ratings at or above this score are sent to your public review link.</InfoTip>
          </Label>
          <Select name="reviewThreshold" defaultValue={String(review.reviewThreshold)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}+ stars
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" loading={pending}>
          Save review settings
        </Button>
      </form>
    </Card>
  );
}
