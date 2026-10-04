import { PageHeaderSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2.5 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-7 w-10" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="rounded-xl border bg-card shadow-xs">
          <div className="space-y-2 p-5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="divide-y border-t">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 sm:px-5">
                <div className="w-20 shrink-0 space-y-1.5">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-3.5 w-12" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border bg-card p-5 shadow-xs">
          <div className="space-y-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-full" />
          </div>
          <Skeleton className="h-9 w-full rounded-lg" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-8 rounded-lg" />
            <Skeleton className="h-8 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
