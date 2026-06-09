"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  createRoutingForm,
  deleteRoutingForm,
  updateRoutingForm,
} from "@/server/routing-forms";

const actionSchema = z.union([
  z.object({ type: z.literal("event_type"), eventTypeId: z.number().int().positive() }),
  z.object({ type: z.literal("external_url"), url: z.string().url() }),
  z.object({ type: z.literal("message"), message: z.string().min(1).max(2000) }),
]);

const fieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(128),
  type: z.enum(["short_text", "long_text", "email", "phone", "number", "select"]),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

const routeSchema = z.object({
  id: z.string().min(1),
  conditions: z.array(
    z.object({
      fieldId: z.string().min(1),
      operator: z.enum(["equals", "not_equals", "contains", "is_any_of"]),
      value: z.string(),
    }),
  ),
  action: actionSchema,
});

const updateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(128),
  description: z.string().max(2000).nullable(),
  fields: z.array(fieldSchema),
  routes: z.array(routeSchema),
  fallback: actionSchema.nullable(),
  active: z.boolean(),
});

export type RoutingFormState = { ok?: boolean; error?: string; id?: number } | null;

export async function createRoutingFormAction(name: string): Promise<RoutingFormState> {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Give the form a name" };
  const id = await createRoutingForm(user.id, trimmed.slice(0, 128));
  revalidatePath("/dashboard/routing");
  return { ok: true, id };
}

export async function saveRoutingFormAction(payload: unknown): Promise<RoutingFormState> {
  const user = await requireUser();
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid form" };
  const { id, ...rest } = parsed.data;
  const ok = await updateRoutingForm(id, user.id, rest);
  if (!ok) return { error: "Could not save form" };
  revalidatePath("/dashboard/routing");
  revalidatePath(`/dashboard/routing/${id}`);
  return { ok: true, id };
}

export async function deleteRoutingFormAction(id: number): Promise<RoutingFormState> {
  const user = await requireUser();
  await deleteRoutingForm(id, user.id);
  revalidatePath("/dashboard/routing");
  return { ok: true };
}
