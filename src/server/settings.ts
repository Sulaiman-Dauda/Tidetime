import "server-only";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/crypto";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
}

/** Get SMTP config from DB (encrypted). Returns null if not configured. */
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.name, "smtp_config"))
    .limit(1);
  if (!row?.value) return null;
  const v = row.value as Record<string, unknown>;
  return {
    host: String(v.host ?? ""),
    port: Number(v.port ?? 587),
    user: String(v.user ?? ""),
    pass: decrypt(String(v.pass ?? "")),
    from: String(v.from ?? ""),
  };
}

/** Store SMTP config (password encrypted at rest). */
export async function setSmtpConfig(config: SmtpConfig): Promise<void> {
  const encrypted = encrypt(config.pass);
  const value = { ...config, pass: encrypted };
  await db
    .insert(appSettings)
    .values({ name: "smtp_config", value })
    .onConflictDoUpdate({ target: appSettings.name, set: { value } });
}

/** Get Stripe config from DB (encrypted). Returns null if not configured. */
export async function getStripeConfig(): Promise<StripeConfig | null> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.name, "stripe_config"))
    .limit(1);
  if (!row?.value) return null;
  const v = row.value as Record<string, unknown>;
  return {
    secretKey: decrypt(String(v.secretKey ?? "")),
    webhookSecret: decrypt(String(v.webhookSecret ?? "")),
  };
}

/** Store Stripe config (keys encrypted at rest). */
export async function setStripeConfig(config: StripeConfig): Promise<void> {
  const value = {
    secretKey: encrypt(config.secretKey),
    webhookSecret: encrypt(config.webhookSecret),
  };
  await db
    .insert(appSettings)
    .values({ name: "stripe_config", value })
    .onConflictDoUpdate({ target: appSettings.name, set: { value } });
}
