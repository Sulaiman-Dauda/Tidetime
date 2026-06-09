import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";
const isBuildCommand = process.env.npm_lifecycle_event === "build";
const DEFAULT_APP_URL = "http://localhost:3100";
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
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  ZOOM_CLIENT_ID: z.string().optional(),
  ZOOM_CLIENT_SECRET: z.string().optional(),
  DAILY_API_KEY: z.string().optional(),
  DAILY_SUBDOMAIN: z.string().optional(),
  HUBSPOT_CLIENT_ID: z.string().optional(),
  HUBSPOT_CLIENT_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  LICENSE_KEY: z.string().optional(),
  LICENSE_PUBLIC_KEY: z.string().optional(),
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

const authSecret = raw.AUTH_SECRET?.trim() || DEFAULT_AUTH_SECRET;
const appUrl = withoutTrailingSlash(raw.APP_URL ?? DEFAULT_APP_URL);
const databaseUrl = raw.DATABASE_URL ?? DEFAULT_DATABASE_URL;

if (isProd) {
  const startupErrors: string[] = [];

  // These secrets are only needed at runtime. `next build` runs with
  // NODE_ENV=production but doesn't connect to anything, so we skip them during
  // the build command — this keeps real secrets out of image build layers.
  if (!isBuildCommand) {
    if (!raw.APP_URL || appUrl === DEFAULT_APP_URL) {
      startupErrors.push("APP_URL must be set explicitly in production.");
    }
    if (!raw.DATABASE_URL || databaseUrl === DEFAULT_DATABASE_URL) {
      startupErrors.push("DATABASE_URL must be set explicitly in production.");
    }
    if (!raw.AUTH_SECRET) {
      startupErrors.push("AUTH_SECRET must be set in production.");
    } else {
      if (authSecret === DEFAULT_AUTH_SECRET) {
        startupErrors.push("AUTH_SECRET cannot use the development default in production.");
      }
      if (authSecret.length < 32) {
        startupErrors.push("AUTH_SECRET must be at least 32 characters in production.");
      }
    }
  }

  if (startupErrors.length > 0) {
    console.error("❌ Unsafe production environment:");
    for (const err of startupErrors) console.error(`- ${err}`);
    process.exit(1);
  }
}

export const env = {
  appUrl,
  appName: raw.APP_NAME ?? "Tidetime",
  databaseUrl,
  authSecret,
} as const;

export { isProd };
