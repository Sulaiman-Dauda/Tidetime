import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getReviewContext } from "@/server/reviews";
import { ReviewForm } from "./review-form";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Leave a review · Tidetime" };

interface Props {
  params: Promise<{ uid: string }>;
}

export default async function ReviewPage({ params }: Props) {
  const { uid } = await params;
  const ctx = await getReviewContext(uid);
  if (!ctx) notFound();

  const alreadyReviewed = Boolean(ctx.existingReview);

  return (
    <main className="min-h-screen bg-grid">
      <div className="mx-auto flex max-w-md flex-col px-4 py-16">
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          {alreadyReviewed ? (
            <div className="flex flex-col items-center text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <h1 className="mt-4 text-xl font-semibold">Thanks for your feedback!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                You&apos;ve already reviewed this booking.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight">How did it go?</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Share your experience with <strong>{ctx.booking.title}</strong>
                {ctx.host.name ? ` and ${ctx.host.name}` : ""}.
              </p>
              <div className="mt-6">
                <ReviewForm uid={ctx.booking.uid} />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
