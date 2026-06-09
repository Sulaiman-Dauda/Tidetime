"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CopyLinkButton } from "@/app/dashboard/_components/copy-link-button";
import { createLinkAction, type LinkState } from "./actions";
import { RevokeLinkButton } from "./revoke-link-button";
import { EmptyState } from "@/components/empty-state";
import type { BookingLinkRow } from "@/server/booking-links";
import { LinkIcon, Loader2, Plus } from "lucide-react";

type Kind = "one_time" | "expiring" | "limited" | "invite" | "static";

const KIND_LABEL: Record<Kind, string> = {
  one_time: "Single use",
  expiring: "Expiring",
  limited: "Limited uses",
  invite: "Invite only",
  static: "Reusable (secret link)",
};

export function LinkManager({
  eventTypes,
  links,
}: {
  eventTypes: { id: number; title: string }[];
  links: BookingLinkRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [kind, setKind] = useState<Kind>("one_time");
  const [eventTypeId, setEventTypeId] = useState<string>("");
  const [state, action, pending] = useActionState<LinkState, FormData>(createLinkAction, {});

  useEffect(() => {
    if (state.ok && state.url) {
      toast({ title: "Link created", description: state.url });
      router.refresh();
    } else if (state.error) {
      toast({ title: "Couldn't create link", description: state.error, variant: "destructive" });
    }
  }, [state, toast, router]);

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <Card className="h-fit space-y-4 p-5">
        <h2 className="font-medium">New link</h2>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="eventTypeId">Service</Label>
            <input type="hidden" name="eventTypeId" value={eventTypeId} />
            <Select value={eventTypeId} onValueChange={setEventTypeId} required>
              <SelectTrigger id="eventTypeId">
                <SelectValue placeholder="Select a service" />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map((et) => (
                  <SelectItem key={et.id} value={String(et.id)}>
                    {et.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Link type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="kind" value={kind} />
          </div>

          {kind === "limited" && (
            <div className="space-y-1.5">
              <Label htmlFor="maxUses">Maximum uses</Label>
              <Input id="maxUses" name="maxUses" type="number" min={1} defaultValue={5} />
            </div>
          )}

          {kind === "expiring" && (
            <div className="space-y-1.5">
              <Label htmlFor="expiresAt">Expires at</Label>
              <Input id="expiresAt" name="expiresAt" type="datetime-local" />
            </div>
          )}

          {kind === "invite" && (
            <div className="space-y-1.5">
              <Label htmlFor="inviteEmail">Invite email</Label>
              <Input id="inviteEmail" name="inviteEmail" type="email" placeholder="guest@example.com" />
            </div>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create link
          </Button>
        </form>
      </Card>

      <div className="space-y-3">
        {links.length === 0 ? (
          <EmptyState
            icon={LinkIcon}
            title="No booking links yet"
            description="Create your first link to start sharing specific availability."
          />
        ) : (
          links.map((link) => (
            <Card key={link.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{link.eventTypeTitle}</span>
                  <Badge variant="secondary">{KIND_LABEL[link.kind as Kind]}</Badge>
                  {link.revoked && <Badge variant="destructive">Revoked</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Used {link.usedCount}
                  {link.maxUses != null ? ` / ${link.maxUses}` : ""}
                  {link.expiresAt ? ` · expires ${new Date(link.expiresAt).toLocaleString()}` : ""}
                  {link.inviteEmail ? ` · ${link.inviteEmail}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!link.revoked && (
                  <CopyLinkButton url={`/i/${link.token}`} label={`/i/${link.token.slice(0, 8)}…`} />
                )}
                {!link.revoked && (
                  <RevokeLinkButton id={link.id} />
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
