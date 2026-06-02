import { PageHeaderSkeleton, CardListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex items-center justify-between">
        <PageHeaderSkeleton />
        <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
      </div>
      <CardListSkeleton rows={4} />
    </div>
  );
}
