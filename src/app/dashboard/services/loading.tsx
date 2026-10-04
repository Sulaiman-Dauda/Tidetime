import { PageHeaderSkeleton, CardListSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeaderSkeleton />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <CardListSkeleton rows={4} />
    </div>
  );
}
