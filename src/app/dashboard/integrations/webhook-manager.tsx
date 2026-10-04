import { Trash2, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { webhooks } from "@/db/schema";
import { createWebhookAction, deleteWebhookAction, toggleWebhookAction } from "./webhook-actions";
import { ConnectionCard } from "./connection-card";

type Hook = typeof webhooks.$inferSelect;
const EVENTS = [
  ["booking_created", "Created"],
  ["booking_rescheduled", "Rescheduled"],
  ["booking_cancelled", "Cancelled"],
  ["booking_requested", "Approval requested"],
  ["booking_rejected", "Rejected"],
] as const;
const EVENT_LABELS = new Map<string, string>(EVENTS);

export function WebhookManager({ hooks }: { hooks: Hook[] }) {
  const activeCount = hooks.filter((hook) => hook.active).length;
  return (
    <ConnectionCard
      icon={Webhook}
      title="Zapier webhooks"
      description="Paste a Zapier Catch Hook URL. Deliveries are signed, stored and retried automatically."
      status={hooks.length > 0 ? (
        <Badge variant="secondary" className="tabular-nums">{activeCount} active</Badge>
      ) : null}
    >
      {hooks.length === 0 ? (
        <p className="border-t px-5 py-4 text-sm text-muted-foreground">No Zapier webhook configured.</p>
      ) : (
        <ul className="divide-y border-t">
          {hooks.map((hook) => (
            <li key={hook.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
              <div className="min-w-0 flex-1 basis-60">
                <p className="truncate font-mono text-meta text-foreground">{hook.subscriberUrl}</p>
                <p className="truncate text-meta text-muted-foreground">
                  {hook.triggers.map((trigger) => EVENT_LABELS.get(trigger) ?? trigger).join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={hook.active ? "success" : "secondary"} dot>
                  {hook.active ? "Active" : "Paused"}
                </Badge>
                <form action={toggleWebhookAction}>
                  <input type="hidden" name="id" value={hook.id} />
                  <input type="hidden" name="active" value={String(hook.active)} />
                  <Button type="submit" size="sm" variant="outline">{hook.active ? "Pause" : "Enable"}</Button>
                </form>
                <form action={deleteWebhookAction}>
                  <input type="hidden" name="id" value={hook.id} />
                  <Button
                    type="submit"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete webhook"
                    title="Delete webhook"
                    className="hover:bg-destructive-subtle hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form action={createWebhookAction} className="mt-auto space-y-3 rounded-b-xl border-t bg-muted/50 px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            name="subscriberUrl"
            type="url"
            required
            aria-label="Zapier Catch Hook URL"
            placeholder="https://hooks.zapier.com/hooks/catch/..."
            className="font-mono text-meta"
          />
          <Button type="submit">Add webhook</Button>
        </div>
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <legend className="sr-only">Events to send</legend>
          <span className="text-meta font-medium text-foreground" aria-hidden>Send on</span>
          {EVENTS.map(([value, label]) => (
            <label key={value} className="inline-flex cursor-pointer items-center gap-1.5 text-meta text-muted-foreground">
              <input
                type="checkbox"
                name="triggers"
                value={value}
                defaultChecked={value !== "booking_rejected"}
                className="size-4 rounded border-input accent-primary"
              />
              {label}
            </label>
          ))}
        </fieldset>
      </form>
    </ConnectionCard>
  );
}
