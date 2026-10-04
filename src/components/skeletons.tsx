import { Skeleton } from "@/components/ui/skeleton";

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

export function CardListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y rounded-xl border bg-card shadow-xs">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function FormCardSkeleton() {
  return (
    <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-44" />
      </div>
      <div className="space-y-5 rounded-xl border bg-card p-5 shadow-xs">
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
    </div>
  );
}
