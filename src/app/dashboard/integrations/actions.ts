"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getApp } from "@/app-store/registry";

/** Disconnect an App Store app for the current user. */
export async function uninstallApp(slug: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const app = getApp(slug);
  if (!app || !app.uninstall) return { ok: false, error: "This app can't be disconnected here." };
  await app.uninstall(user.id);
  revalidatePath("/dashboard/integrations");
  return { ok: true };
}
