import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-56 mt-0.5" />
        </div>
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="rounded-lg border border-border bg-card p-5">
          <Skeleton className="h-4 w-28 mb-4" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 border-b py-3 last:border-0">
              <Skeleton className="h-5 w-20" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-9 w-56" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
      </div>
    </div>
  );
}
