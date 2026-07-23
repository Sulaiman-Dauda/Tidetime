import "server-only";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/crypto";
import { z } from "zod";

export const emailProviderSchema = z.enum(["smtp", "microsoft365"]);
export type EmailProvider = z.infer<typeof emailProviderSchema>;

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

export const microsoftEmailConfigSchema = z.object({
  tenantId: z.string().trim().uuid("Directory Tenant ID must be a valid UUID"),
  clientId: z.string().trim().uuid("Application Client ID must be a valid UUID"),
  clientSecret: z.string().max(2_048).default(""),
  fromName: z.string().trim().min(1, "Sender name is required").max(128),
});

export type MicrosoftEmailConfig = z.infer<typeof microsoftEmailConfigSchema>;

export interface MicrosoftEmailConnection {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  account: {
    id: string;
    email: string;
    name: string;
    tenantId?: string;
  };
}

const SMTP_KEY = "smtp_config";
const MICROSOFT_CONFIG_KEY = "microsoft_email_config";
const MICROSOFT_CONNECTION_KEY = "microsoft_email_connection";
const EMAIL_PROVIDER_KEY = "email_provider";

async function getSetting(name: string): Promise<Record<string, unknown> | null> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.name, name))
    .limit(1);
  return row?.value && typeof row.value === "object"
    ? row.value as Record<string, unknown>
    : null;
}

async function setSetting(name: string, value: Record<string, unknown>): Promise<void> {
  await db
    .insert(appSettings)
    .values({ name, value })
    .onConflictDoUpdate({ target: appSettings.name, set: { value } });
}

async function deleteSetting(name: string): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.name, name));
}

/** Get SMTP config from DB (encrypted). Returns null if not configured. */
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const v = await getSetting(SMTP_KEY);
  if (!v) return null;
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
  await setSetting(SMTP_KEY, value);
}

export async function getEmailProvider(): Promise<EmailProvider> {
  const value = await getSetting(EMAIL_PROVIDER_KEY);
  const parsed = emailProviderSchema.safeParse(value?.provider);
  return parsed.success ? parsed.data : "smtp";
}

export async function setEmailProvider(provider: EmailProvider): Promise<void> {
  await setSetting(EMAIL_PROVIDER_KEY, { provider });
}

export async function getMicrosoftEmailConfig(): Promise<MicrosoftEmailConfig | null> {
  const value = await getSetting(MICROSOFT_CONFIG_KEY);
  if (!value) return null;
  try {
    return {
      tenantId: String(value.tenantId ?? ""),
      clientId: String(value.clientId ?? ""),
      clientSecret: decrypt(String(value.clientSecret ?? "")),
      fromName: String(value.fromName ?? ""),
    };
  } catch {
    return null;
  }
}

/**
 * Store Microsoft Entra application credentials. An empty secret retains the
 * existing value because secrets are never returned to the browser.
 */
export async function setMicrosoftEmailConfig(config: MicrosoftEmailConfig): Promise<void> {
  const existing = await getMicrosoftEmailConfig();
  const clientSecret = config.clientSecret || existing?.clientSecret || "";
  if (!clientSecret) throw new Error("Application Client Secret is required");

  // Tokens belong to the app registration that issued them. Changing the
  // client id therefore disconnects the old account instead of leaving a
  // misleading, unusable connection behind.
  if (
    existing &&
    (existing.clientId !== config.clientId || existing.tenantId !== config.tenantId)
  ) {
    await deleteMicrosoftEmailConnection();
    if (await getEmailProvider() === "microsoft365") {
      await setEmailProvider("smtp");
    }
  }

  await setSetting(MICROSOFT_CONFIG_KEY, {
    tenantId: config.tenantId,
    clientId: config.clientId,
    clientSecret: encrypt(clientSecret),
    fromName: config.fromName,
  });
}

export async function getMicrosoftEmailConnection(): Promise<MicrosoftEmailConnection | null> {
  const value = await getSetting(MICROSOFT_CONNECTION_KEY);
  const encrypted = value?.credential;
  if (typeof encrypted !== "string" || !encrypted) return null;
  try {
    const parsed = JSON.parse(decrypt(encrypted)) as MicrosoftEmailConnection;
    if (
      !parsed.accessToken ||
      !parsed.refreshToken ||
      !Number.isFinite(parsed.expiresAt) ||
      !parsed.account?.id ||
      !parsed.account.email
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function setMicrosoftEmailConnection(
  connection: MicrosoftEmailConnection,
): Promise<void> {
  await setSetting(MICROSOFT_CONNECTION_KEY, {
    credential: encrypt(JSON.stringify(connection)),
  });
}

export async function deleteMicrosoftEmailConnection(): Promise<void> {
  await deleteSetting(MICROSOFT_CONNECTION_KEY);
}
