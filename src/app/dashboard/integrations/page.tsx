import { eq } from "drizzle-orm";
import { Calendar, CreditCard, Video, Webhook } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { db } from "@/db";
import { credentials } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";

export const metadata = { title: "Integrations" };

const CATALOG = [
  {
    type: "stripe",
    name: "Stripe",
    description:
      "Collect payments for paid events and confirm bookings via signed webhooks.",
    icon: CreditCard,
    availability: "ready",
  },
  {
    type: "webhook",
    name: "Webhooks",
    description:
      "Send booking lifecycle events to any HTTP endpoint with HMAC signatures.",
    icon: Webhook,
    availability: "ready",
  },
  {
    type: "google_calendar",
    name: "Google Calendar",
    description:
      "Credential storage is modeled, but the OAuth connection flow is not yet shipped.",
    icon: Calendar,
    availability: "planned",
  },
  {
    type: "google_meet",
    name: "Google Meet",
    description:
      "Conference provider connection flows are planned for a future release.",
    icon: Video,
    availability: "planned",
  },
  {
    type: "zoom",
    name: "Zoom",
    description:
      "Conference provider connection flows are planned for a future release.",
    icon: Video,
    availability: "planned",
  },
] as const;

type CatalogType = (typeof CATALOG)[number]["type"];

function getStatus(
  type: CatalogType,
  installedTypes: Set<string>,
): { label: string; hint: string; variant: BadgeProps["variant"] } {
  if (type === "stripe") {
    return env.stripe.secretKey
      ? {
          label: "Configured",
          hint: "STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set.",
          variant: "success",
        }
      : {
          label: "Needs setup",
          hint: "Add the Stripe environment variables to enable paid bookings.",
          variant: "secondary",
        };
  }
  if (type === "webhook") {
    return {
      label: "Available",
      hint: "Manage webhooks through the REST API today.",
      variant: "success",
    };
  }
  if (installedTypes.has(type)) {
    return {
      label: "Credential stored",
      hint: "A credential row exists, but the connection UI is not yet available.",
      variant: "secondary",
    };
  }
  return {
    label: "Planned",
    hint: "Tracked in the schema and UI, but not production-ready yet.",
    variant: "secondary",
  };
}

export default async function IntegrationsPage() {
  const user = await requireUser();
  const installed = await db
    .select({ type: credentials.type })
    .from(credentials)
    .where(eq(credentials.userId, user.id));
  const installedTypes = new Set(installed.map((row) => row.type));

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Stripe payments and signed webhooks are production-ready today. Provider OAuth flows are
          tracked here and clearly marked when still planned.
        </p>
      </div>

      <div className="divide-y divide-border rounded-2xl border border-border/60 bg-card">
        {CATALOG.map(({ type, name, description, icon: Icon }) => {
          const status = getStatus(type, installedTypes);
          return (
            <div
              key={type}
              className="flex items-center gap-5 px-5 py-4 transition-colors hover:bg-secondary/30"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-secondary text-foreground">
                <Icon className="h-4 w-4" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium text-foreground">{name}</span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
              </div>

              <p className="hidden max-w-[180px] shrink-0 text-right text-[12px] text-muted-foreground sm:block">
                {status.hint}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
