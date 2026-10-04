import { PageHeaderSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Without its own loading state the detail route fell back to the list
// skeleton from bookings/loading.tsx, which flashed the wrong layout.
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <PageHeaderSkeleton />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-6">
          {[3, 4].map((rows, i) => (
            <div key={i} className="rounded-xl border bg-card shadow-xs">
              <div className="p-5 pb-3">
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="divide-y border-t">
                {Array.from({ length: rows }).map((_, j) => (
                  <div key={j} className="flex items-center gap-4 px-5 py-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="order-first space-y-4 rounded-xl border bg-card p-5 shadow-xs lg:order-none">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
