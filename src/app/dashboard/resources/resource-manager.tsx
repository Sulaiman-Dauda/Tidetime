"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  createResourceAction,
  deleteResourceAction,
  type ResourceState,
} from "./actions";
import type { Resource } from "@/db/schema";
import { Loader2, Plus, Trash2, Box } from "lucide-react";

const TYPES = ["room", "studio", "equipment", "vehicle", "desk", "other"] as const;

export function ResourceManager({
  resources,
  usage = {},
}: {
  resources: Resource[];
  usage?: Record<number, number>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, action, pending] = useActionState<ResourceState, FormData>(
    createResourceAction,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast({ title: "Resource created" });
      router.refresh();
    } else if (state.error) {
      toast({ title: "Could not save", description: state.error, variant: "destructive" });
    }
  }, [state, toast, router]);

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <Card className="h-fit space-y-4 p-5">
        <h2 className="font-medium">New resource</h2>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Studio A" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              name="type"
              defaultValue="room"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t[0].toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              defaultValue={1}
              required
            />
            <p className="text-xs text-muted-foreground">
              How many concurrent bookings this resource supports.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" placeholder="Optional" />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add resource
          </Button>
        </form>
      </Card>

      <div className="space-y-3">
        {resources.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed py-16 text-center">
            <Box className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No resources yet.</p>
          </div>
        ) : (
          resources.map((r) => (
            <Card key={r.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                {r.color ? (
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: r.color }}
                    aria-hidden
                  />
                ) : null}
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.type} · capacity {r.capacity}
                    {r.description ? ` · ${r.description}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {usage[r.id]
                      ? `Used by ${usage[r.id]} event type${usage[r.id] === 1 ? "" : "s"}`
                      : "Not attached to any event type yet"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.active ? (
                  <Badge variant="secondary">Active</Badge>
                ) : (
                  <Badge variant="outline">Inactive</Badge>
                )}
                <form action={deleteResourceAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    aria-label="Delete resource"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
