import { requireUser } from "@/lib/auth";
import { listServiceCategoriesWithCounts } from "@/server/service-categories";
import { CategoriesManager } from "./categories-manager";

export const metadata = { title: "Service Categories" };

export default async function CategoriesPage() {
  await requireUser();
  const categories = await listServiceCategoriesWithCounts();

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Service Categories</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Group your services so customers can find them quickly on the booking page. Assign a
          category to each event type from its editor.
        </p>
      </div>
      <CategoriesManager categories={categories} />
    </div>
  );
}
