"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { webhooks, webhookTrigger } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import { webhookUrlSchema } from "@/lib/schemas";
import { assertPublicUrl } from "@/server/ssrf";

const schema = z.object({
  subscriberUrl: webhookUrlSchema,
  triggers: z.array(z.enum(webhookTrigger.enumValues)).min(1, "Choose at least one event"),
});

export async function createWebhookAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = schema.safeParse({
    subscriberUrl: formData.get("subscriberUrl"),
    triggers: formData.getAll("triggers"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid webhook");
  await assertPublicUrl(parsed.data.subscriberUrl);
  await db.insert(webhooks).values({
    subscriberUrl: parsed.data.subscriberUrl,
    triggers: parsed.data.triggers,
    secret: randomToken(32),
    active: true,
  });
  revalidatePath("/dashboard/integrations");
}

export async function toggleWebhookAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "true";
  if (!Number.isInteger(id)) return;
  await db.update(webhooks).set({ active: !active }).where(eq(webhooks.id, id));
  revalidatePath("/dashboard/integrations");
}

export async function deleteWebhookAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await db.delete(webhooks).where(eq(webhooks.id, id));
  revalidatePath("/dashboard/integrations");
}
