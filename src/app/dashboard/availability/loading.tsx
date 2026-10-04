import { PageHeaderSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeaderSkeleton />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
      <Skeleton className="h-9 w-56 rounded-lg" />
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="divide-y rounded-xl border bg-card shadow-xs">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-9 w-64 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
