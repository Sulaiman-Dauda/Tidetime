import "server-only";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/crypto";
import { z } from "zod";

export const smtpConfigSchema = z.object({
  host: z.string().trim().min(1, "SMTP host is required").max(255)
    .regex(/^[^\s/:]+$/, "Enter a hostname or IP address without a protocol"),
  port: z.coerce.number().int().min(1).max(65_535),
  user: z.string().trim().max(255).default(""),
  pass: z.string().max(1_024).default(""),
  from: z.string().trim().min(3, "From address is required").max(320)
    .refine((value) => !/[\r\n]/.test(value), "From address must be a single line"),
});

export type SmtpConfig = z.infer<typeof smtpConfigSchema>;


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
  // An empty password means "keep the existing secret". The settings API
  // never sends stored passwords back to the browser, so this lets admins edit
  // non-secret fields without accidentally replacing the credential.
  const existing = config.pass ? null : await getSmtpConfig();
  const pass = config.pass || existing?.pass || "";
  const value = { ...config, pass: encrypt(pass) };
  await db
    .insert(appSettings)
    .values({ name: "smtp_config", value })
    .onConflictDoUpdate({ target: appSettings.name, set: { value } });
}
