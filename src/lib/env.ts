import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";
const DEFAULT_APP_URL = "http://localhost:3000";
const DEFAULT_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/tidetime";
const DEFAULT_AUTH_SECRET = "dev-insecure-secret-change-me";

const rawEnvSchema = z
  .object({
    APP_URL: z.string().trim().url().optional(),
    APP_NAME: z.string().trim().min(1).max(100).optional(),
    DATABASE_URL: z.string().trim().min(1).optional(),
    AUTH_SECRET: z.string().optional(),
    SMTP_HOST: z.string().trim().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().trim().optional(),
    STRIPE_SECRET_KEY: z.string().trim().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().trim().optional(),
  })
  .superRefine((raw, ctx) => {
    if (isProd && !raw.APP_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["APP_URL"],
        message: "APP_URL is required in production",
      });
    }

    if (isProd && !raw.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required in production",
      });
    }

    if (isProd && (!raw.AUTH_SECRET || raw.AUTH_SECRET.length < 32)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_SECRET"],
        message:
          "AUTH_SECRET must be set and at least 32 characters long in production. Generate one with: openssl rand -base64 32",
      });
    }

    const hasStripeSecret = Boolean(raw.STRIPE_SECRET_KEY);
    const hasStripeWebhook = Boolean(raw.STRIPE_WEBHOOK_SECRET);
    if (hasStripeSecret !== hasStripeWebhook) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasStripeSecret ? ["STRIPE_WEBHOOK_SECRET"] : ["STRIPE_SECRET_KEY"],
        message:
          "STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be configured together",
      });
    }
  });

const raw = rawEnvSchema.parse(process.env);

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export const env = {
  appUrl: withoutTrailingSlash(raw.APP_URL ?? DEFAULT_APP_URL),
  appName: raw.APP_NAME ?? "Tidetime",
  databaseUrl: raw.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  authSecret: raw.AUTH_SECRET || DEFAULT_AUTH_SECRET,
  smtp: {
    host: raw.SMTP_HOST ?? "",
    port: raw.SMTP_PORT ?? 587,
    user: raw.SMTP_USER ?? "",
    password: raw.SMTP_PASSWORD ?? "",
    from: raw.SMTP_FROM ?? "Tidetime <no-reply@tidetime.app>",
  },
  stripe: {
    secretKey: raw.STRIPE_SECRET_KEY ?? "",
    webhookSecret: raw.STRIPE_WEBHOOK_SECRET ?? "",
  },
} as const;

export { isProd };
