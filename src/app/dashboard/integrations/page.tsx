import { requirePermission } from "@/lib/guard";
import { getStripeConfig } from "@/server/settings";
import { getCurrentUser } from "@/lib/auth";
import { isGoogleConnected } from "@/server/google-calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Mail, Webhook, Calendar } from "lucide-react";

export const metadata = { title: "Connections" };

export default async function IntegrationsPage() {
  await requirePermission("team.manage");
  const user = await getCurrentUser();
  const stripeConfig = await getStripeConfig();
  const stripeConfigured = Boolean(
    stripeConfig?.publishableKey && stripeConfig?.secretKey && stripeConfig?.webhookSecret,
  );
  const googleConnected = user ? await isGoogleConnected(user.id) : false;

  const items = [
    {
      name: "Google Calendar",
      icon: Calendar,
      badge: googleConnected
        ? { label: "Connected", variant: "success" as const }
        : { label: "Available", variant: "outline" as const },
      description: googleConnected
        ? "Your Google Calendar is connected. Busy time is synced and new bookings create calendar events."
        : "Connect your Google Calendar to sync availability and create events automatically.",
    },
    {
      name: "Email (SMTP)",
      icon: Mail,
      badge: { label: "Ready", variant: "success" as const },
      description: "Configure and test SMTP in Settings → Email for confirmations, reminders, and cancellations.",
    },
    {
      name: "Webhooks",
      icon: Webhook,
      badge: { label: "Ready", variant: "success" as const },
      description: "Outgoing booking lifecycle webhooks are available today through the REST API.",
    },
    {
      name: "Stripe",
      icon: CreditCard,
      badge: stripeConfigured
        ? { label: "Configured", variant: "success" as const }
        : { label: "Optional", variant: "secondary" as const },
      description: stripeConfigured
        ? "Stripe is configured for live paid-booking checkout, payment webhooks, and attendee card collection."
        : "Add your Stripe publishable key, secret key, and webhook secret in Settings → Stripe to accept payments.",
    },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Connections</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
          Connect Tidetime to the tools you already use.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {items.map(({ name, icon: Icon, badge, description }) => (
          <Card key={name} className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-secondary text-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
