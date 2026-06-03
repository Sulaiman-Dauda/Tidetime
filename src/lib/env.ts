import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";
const DEFAULT_APP_URL = "http://localhost:3000";
const DEFAULT_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/tidetime";
const DEFAULT_AUTH_SECRET = "dev-insecure-secret-change-me";

/**
 * Only bootstrap config lives in .env.
 * Everything else (SMTP, Stripe, etc.) is managed via Settings → UI and stored
 * encrypted in the database. No ambiguity — DB always wins.
 */
const rawEnvSchema = z.object({
  APP_URL: z.string().trim().url().optional(),
  APP_NAME: z.string().trim().min(1).max(100).optional(),
  DATABASE_URL: z.string().trim().min(1).optional(),
  AUTH_SECRET: z.string().optional(),
});

const validated = rawEnvSchema.safeParse(process.env);

if (!validated.success && isProd) {
  console.error("❌ Invalid environment variables:");
  console.error(validated.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = validated.success ? validated.data : {};

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export const env = {
  appUrl: withoutTrailingSlash(raw.APP_URL ?? DEFAULT_APP_URL),
  appName: raw.APP_NAME ?? "Tidetime",
  databaseUrl: raw.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  authSecret: raw.AUTH_SECRET || DEFAULT_AUTH_SECRET,
} as const;

export { isProd };
