import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
        <div className="rounded-xl border bg-card shadow-xs">
          <div className="flex h-14 items-center justify-between gap-3 border-b px-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
          <div className="h-8 border-b bg-muted/50" />
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "min-h-14 p-1 sm:min-h-28 sm:p-1.5",
                  (i + 1) % 7 !== 0 && "border-r",
                  i < 28 && "border-b",
                )}
              >
                <Skeleton className="size-6 rounded-full" />
              </div>
            ))}
          </div>
          <div className="h-9 border-t" />
        </div>

        <div className="rounded-xl border bg-card shadow-xs">
          <div className="flex h-14 items-center justify-between gap-3 border-b px-4">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2 px-4 py-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
