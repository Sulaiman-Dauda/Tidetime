import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-10 w-44 rounded-xl" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card p-4">
          <div className="grid grid-cols-7 gap-2 border-b border-border/50 pb-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="min-h-[96px] rounded-xl" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-24" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
