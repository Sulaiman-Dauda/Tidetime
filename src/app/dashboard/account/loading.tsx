import { FormCardSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-64 mt-0.5" />
      </div>
      <FormCardSkeleton />
      <FormCardSkeleton />
      <FormCardSkeleton />
    </div>
  );
}
