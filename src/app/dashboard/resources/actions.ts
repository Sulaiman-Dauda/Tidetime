"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createResource, updateResource, deleteResource } from "@/server/resources";

const RESOURCE_TYPES = ["room", "studio", "equipment", "vehicle", "desk", "other"] as const;

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(128),
  type: z.enum(RESOURCE_TYPES),
  capacity: z.coerce.number().int().min(1).max(1000).default(1),
  description: z.string().trim().max(500).optional(),
  color: z.string().trim().max(9).optional(),
});

export interface ResourceState {
  ok?: boolean;
  error?: string;
}

export async function createResourceAction(
  _prev: ResourceState,
  formData: FormData,
): Promise<ResourceState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    capacity: formData.get("capacity") || 1,
    description: formData.get("description") || undefined,
    color: formData.get("color") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await createResource({
    userId: user.id,
    name: parsed.data.name,
    type: parsed.data.type,
    capacity: parsed.data.capacity,
    description: parsed.data.description ?? null,
    color: parsed.data.color ?? null,
  });

  revalidatePath("/dashboard/resources");
  return { ok: true };
}

export async function updateResourceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const capacity = Number(formData.get("capacity"));
  await updateResource(id, user.id, {
    name: String(formData.get("name") ?? "").trim() || undefined,
    capacity: Number.isFinite(capacity) && capacity >= 1 ? Math.round(capacity) : undefined,
    active: formData.get("active") === "true",
  });
  revalidatePath("/dashboard/resources");
}

export async function deleteResourceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id)) {
    await deleteResource(id, user.id);
    revalidatePath("/dashboard/resources");
  }
}
