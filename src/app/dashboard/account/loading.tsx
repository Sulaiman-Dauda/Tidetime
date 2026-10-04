import { FormCardSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="space-y-8">
        <FormCardSkeleton />
        <FormCardSkeleton />
        <FormCardSkeleton />
      </div>
    </div>
  );
}
