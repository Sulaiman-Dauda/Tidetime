import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";
const isBuildCommand = process.env.npm_lifecycle_event === "build";
const DEFAULT_APP_URL = "http://localhost:3100";
const DEFAULT_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/tidetime";
const DEFAULT_AUTH_SECRET = "dev-insecure-secret-change-me";

/**
 * Runtime configuration is deliberately small in the lite build.
 */
const rawEnvSchema = z.object({
  APP_URL: z.string().trim().url().optional(),
  APP_NAME: z.string().trim().min(1).max(100).optional(),
  DATABASE_URL: z.string().trim().min(1).optional(),
  AUTH_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

// Read keys explicitly. Passing the whole `process.env` object allows some
// standalone bundlers to snapshot an empty build-time environment.
const validated = rawEnvSchema.safeParse({
  APP_URL: process.env.APP_URL,
  APP_NAME: process.env.APP_NAME,
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
});

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
    if (!raw.CRON_SECRET?.trim()) {
      startupErrors.push("CRON_SECRET must be set in production.");
    } else if (raw.CRON_SECRET.trim().length < 32) {
      startupErrors.push("CRON_SECRET must be at least 32 characters in production.");
    }
    if (Boolean(raw.GOOGLE_CLIENT_ID?.trim()) !== Boolean(raw.GOOGLE_CLIENT_SECRET?.trim())) {
      startupErrors.push(
        "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must either both be set or both be omitted.",
      );
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
