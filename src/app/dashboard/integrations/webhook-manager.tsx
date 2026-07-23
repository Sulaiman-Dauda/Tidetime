import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { webhooks } from "@/db/schema";
import { createWebhookAction, deleteWebhookAction, toggleWebhookAction } from "./webhook-actions";

type Hook = typeof webhooks.$inferSelect;
const EVENTS = [
  ["booking_created", "Created"],
  ["booking_rescheduled", "Rescheduled"],
  ["booking_cancelled", "Cancelled"],
  ["booking_requested", "Approval requested"],
  ["booking_rejected", "Rejected"],
] as const;

export function WebhookManager({ hooks }: { hooks: Hook[] }) {
  return (
    <Card className="space-y-5 p-6">
      <div>
        <h2 className="text-sm font-semibold">Zapier webhooks</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste a Zapier Catch Hook URL. Deliveries are signed, stored, and retried automatically.
        </p>
      </div>
      <form action={createWebhookAction} className="space-y-3 rounded-xl border border-border/60 p-4">
        <Input name="subscriberUrl" type="url" required placeholder="https://hooks.zapier.com/hooks/catch/..." />
        <div className="flex flex-wrap gap-3">
          {EVENTS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" name="triggers" value={value} defaultChecked={value !== "booking_rejected"} />
              {label}
            </label>
          ))}
        </div>
        <Button type="submit" size="sm">Add webhook</Button>
      </form>
      <div className="space-y-2">
        {hooks.length === 0 ? <p className="text-sm text-muted-foreground">No Zapier webhook configured.</p> : null}
        {hooks.map((hook) => (
          <div key={hook.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 p-3">
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{hook.subscriberUrl}</span>
            <Badge variant={hook.active ? "success" : "secondary"}>{hook.active ? "Active" : "Paused"}</Badge>
            <form action={toggleWebhookAction}>
              <input type="hidden" name="id" value={hook.id} />
              <input type="hidden" name="active" value={String(hook.active)} />
              <Button type="submit" size="sm" variant="outline">{hook.active ? "Pause" : "Enable"}</Button>
            </form>
            <form action={deleteWebhookAction}>
              <input type="hidden" name="id" value={hook.id} />
              <Button type="submit" size="sm" variant="destructive">Delete</Button>
            </form>
          </div>
        ))}
      </div>
    </Card>
  );
}
