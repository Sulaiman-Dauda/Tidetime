import { requireUser } from "@/lib/auth";
import { listReviews, reviewStats } from "@/server/reviews";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "../_components/page-header";
import { DeleteReviewButton } from "./delete-review-button";
import { Star, MessageSquare } from "lucide-react";

export const metadata = { title: "Reviews" };

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className="h-3.5 w-3.5"
          fill={n <= rating ? "#f59e0b" : "none"}
          color={n <= rating ? "#f59e0b" : "hsl(var(--border))"}
        />
      ))}
    </span>
  );
}

export default async function ReviewsPage() {
  const user = await requireUser();
  const [reviews, stats] = await Promise.all([listReviews(user.id), reviewStats(user.id)]);

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Reviews"
        description="Feedback collected after bookings. Happy attendees are directed to your public review page; the rest stays private here."
      />

      {stats.count > 0 && (
        <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground">{stats.publicCount}</span> happy attendee
          {stats.publicCount === 1 ? " was" : "s were"} sent to your public review page, while{" "}
          <span className="font-medium text-foreground">{stats.privateCount}</span> piece
          {stats.privateCount === 1 ? "" : "s"} of private feedback stayed here for you to act on —
          protecting your public reputation.
        </div>
      )}

      {/* Stats strip */}
      <div className="grid gap-px rounded-xl border border-border bg-border sm:grid-cols-3">
        <div className="bg-card p-5 sm:rounded-l-lg">
          <p className="text-xs font-medium text-muted-foreground">Average rating</p>
          <p className="mt-2 tabular-stat text-3xl font-semibold text-foreground">
            {stats.average.toFixed(1)}
          </p>
        </div>
        <div className="bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Total reviews</p>
          <p className="mt-2 tabular-stat text-3xl font-semibold text-foreground">
            {stats.count}
          </p>
        </div>
        <div className="bg-card p-5 sm:rounded-r-lg">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Distribution</p>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="flex items-center gap-2 text-[11px]">
                <span className="w-3 text-muted-foreground">{n}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{
                      width: stats.count
                        ? `${((stats.distribution[n] ?? 0) / stats.count) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
                <span className="w-4 text-right text-muted-foreground">
                  {stats.distribution[n] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Review list */}
      {reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No reviews yet"
          description="Reviews appear here once attendees submit feedback after their bookings."
        />
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border/60 bg-card">
          {reviews.map((r) => (
            <div key={r.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Stars rating={r.rating} />
                  <span className="text-[13px] font-medium text-foreground">
                    {r.attendeeName ?? "Anonymous"}
                  </span>
                  {r.eventTitle && (
                    <Badge variant="secondary" className="text-[11px]">
                      {r.eventTitle}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                  <DeleteReviewButton id={r.id} />
                </div>
              </div>
              {r.feedback && (
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {r.feedback}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
