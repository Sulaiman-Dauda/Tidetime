"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { updateCustomerDetails } from "@/server/customers";
import { setCustomerFieldDefs } from "@/server/customer-fields";

export type CustomerActionState = { ok?: boolean; error?: string } | null;

export async function updateCustomerAction(
  customerId: number,
  input: { notes?: string | null; customFields?: Record<string, string> },
): Promise<CustomerActionState> {
  const user = await requireUser();
  const res = await updateCustomerDetails(user.id, customerId, input);
  if (!res.ok) return { error: res.error };
  revalidatePath("/dashboard/customers");
  return { ok: true };
}

export async function saveCustomerFieldsAction(defs: unknown): Promise<CustomerActionState> {
  const user = await requireUser();
  if (!user.isAdmin) return { error: "Only an admin can change custom fields." };
  await setCustomerFieldDefs(defs);
  revalidatePath("/dashboard/customers");
  return { ok: true };
}
