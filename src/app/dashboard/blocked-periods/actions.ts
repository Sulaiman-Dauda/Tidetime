"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createBlockedPeriod, deleteBlockedPeriod } from "@/server/blocked-periods";

const createSchema = z
  .object({
    start: z.string().min(1, "Start is required"),
    end: z.string().min(1, "End is required"),
    reason: z.string().trim().max(255).optional(),
  })
  .refine((v) => !Number.isNaN(Date.parse(v.start)) && !Number.isNaN(Date.parse(v.end)), {
    message: "Enter valid dates",
  });

export interface BlockedPeriodState {
  ok?: boolean;
  error?: string;
}

export async function createBlockedPeriodAction(
  _prev: BlockedPeriodState,
  formData: FormData,
): Promise<BlockedPeriodState> {
  await requireAdmin();
  const parsed = createSchema.safeParse({
    start: formData.get("start"),
    end: formData.get("end"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const created = await createBlockedPeriod({
    start: new Date(parsed.data.start),
    end: new Date(parsed.data.end),
    reason: parsed.data.reason ?? null,
  });
  if (!created) return { error: "End must be after start" };

  revalidatePath("/dashboard/blocked-periods");
  return { ok: true };
}

export async function deleteBlockedPeriodAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await deleteBlockedPeriod(id);
  revalidatePath("/dashboard/blocked-periods");
}
