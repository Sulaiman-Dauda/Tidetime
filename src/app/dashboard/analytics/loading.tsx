import { PageHeaderSkeleton, StatGridSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeaderSkeleton />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <StatGridSkeleton />
      <div className="rounded-lg border border-border bg-card p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-48 mt-1" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-1.5 flex-1 rounded-full" />
              <Skeleton className="h-4 w-6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
