"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, CalendarOff } from "lucide-react";
import {
  createBlockedPeriodAction,
  type BlockedPeriodState,
} from "./actions";
import { DeleteBlockedPeriodButton } from "./delete-blocked-period-button";

type Period = { id: number; start: string; end: string; reason: string | null };

function formatRange(start: string, end: string): string {
  const fmt = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `${fmt.format(new Date(start))} → ${fmt.format(new Date(end))}`;
}

export function BlockedPeriodsManager({ periods }: { periods: Period[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, action, pending] = useActionState<BlockedPeriodState, FormData>(
    createBlockedPeriodAction,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast({ title: "Blocked period added" });
      router.refresh();
    } else if (state.error) {
      toast({ title: "Could not save", description: state.error, variant: "destructive" });
    }
  }, [state, toast, router]);

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <Card className="h-fit space-y-4 p-5">
        <h2 className="font-medium">New blocked period</h2>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="start">Start</Label>
            <Input id="start" name="start" type="datetime-local" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end">End</Label>
            <Input id="end" name="end" type="datetime-local" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Input id="reason" name="reason" placeholder="Public holiday (optional)" />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add blocked period
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-medium">Scheduled closures</h2>
        {periods.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <CalendarOff className="h-8 w-8 opacity-50" />
            No blocked periods yet.
          </div>
        ) : (
          <ul className="divide-y">
            {periods.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{formatRange(p.start, p.end)}</p>
                  {p.reason && <p className="truncate text-xs text-muted-foreground">{p.reason}</p>}
                </div>
                <DeleteBlockedPeriodButton id={p.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
