"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { setFeatureFlag, type FeatureFlag } from "@/server/feature-flags";

export type FeatureFlagState = { ok?: boolean; error?: string } | null;

const schema = z.object({
  flag: z.enum(["crm"]),
  enabled: z.boolean(),
});

/** Toggle an instance feature flag (admin only). */
export async function setFeatureFlagAction(
  flag: FeatureFlag,
  enabled: boolean,
): Promise<FeatureFlagState> {
  await requireAdmin();
  const parsed = schema.safeParse({ flag, enabled });
  if (!parsed.success) return { error: "Invalid feature flag" };
  await setFeatureFlag(parsed.data.flag, parsed.data.enabled);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
