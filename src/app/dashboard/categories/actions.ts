"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  createServiceCategory,
  deleteServiceCategory,
  updateServiceCategory,
} from "@/server/service-categories";

export type CategoryState = { ok?: boolean; error?: string } | null;

const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(128),
  description: z.string().trim().max(500).optional(),
  color: z
    .union([z.string().trim().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/), z.literal("")])
    .optional(),
});

export async function createCategoryAction(_prev: CategoryState, formData: FormData): Promise<CategoryState> {
  await requireUser();
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    color: formData.get("color") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createServiceCategory({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    color: parsed.data.color || null,
  });
  revalidatePath("/dashboard/categories");
  return { ok: true };
}

export async function updateCategoryAction(_prev: CategoryState, formData: FormData): Promise<CategoryState> {
  await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "Invalid category" };
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    color: formData.get("color") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await updateServiceCategory(id, {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    color: parsed.data.color || null,
  });
  revalidatePath("/dashboard/categories");
  return { ok: true };
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id) && id > 0) await deleteServiceCategory(id);
  revalidatePath("/dashboard/categories");
}
