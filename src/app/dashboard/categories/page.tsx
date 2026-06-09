import { requireUser } from "@/lib/auth";
import { listServiceCategoriesWithCounts } from "@/server/service-categories";
import { CategoriesManager } from "./categories-manager";
import { PageHeader } from "@/app/dashboard/_components/page-header";

export const metadata = { title: "Service Categories" };

export default async function CategoriesPage() {
  await requireUser();
  const categories = await listServiceCategoriesWithCounts();

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Service Categories"
        description="Group your services so customers can find them quickly on the booking page. Assign a category to each service from its editor."
      />
      <CategoriesManager categories={categories} />
    </div>
  );
}
