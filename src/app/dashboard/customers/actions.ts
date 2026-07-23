"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/guard";
import { deleteCustomer } from "@/server/customers";

/** Remove a customer record (GDPR-style). Their bookings are untouched. */
export async function deleteCustomerAction(formData: FormData): Promise<void> {
  const { teamId } = await requirePermission("customer.all.view");
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  await deleteCustomer(teamId, id);
  revalidatePath("/dashboard/customers");
  redirect("/dashboard/customers");
}
