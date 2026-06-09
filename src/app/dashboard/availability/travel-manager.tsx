"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plane, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { addTravelScheduleAction, deleteTravelScheduleAction } from "./actions";

interface TravelRow {
  id: number;
  timeZone: string;
  startDate: string;
  endDate: string;
}

function formatDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function TravelManager({
  travels,
  timeZones,
  homeTimeZone,
}: {
  travels: TravelRow[];
  timeZones: string[];
  homeTimeZone: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [tz, setTz] = useState(homeTimeZone);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function add() {
    if (!startDate || !endDate) {
      toast({ title: "Pick a start and end date", variant: "destructive" });
      return;
    }
    start(async () => {
      const res = await addTravelScheduleAction({ timeZone: tz, startDate, endDate });
      if (res.ok) {
        toast({ title: "Travel period added" });
        setStartDate("");
        setEndDate("");
        router.refresh();
      } else {
        toast({ title: "Couldn't add", description: res.error, variant: "destructive" });
      }
    });
  }

  function remove(id: number) {
    start(async () => {
      await deleteTravelScheduleAction(id);
      router.refresh();
    });
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <Plane className="h-4 w-4 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold">Travel schedules</h3>
          <p className="text-xs text-muted-foreground">
            Temporarily treat your availability as another timezone while you&apos;re away — no need to
            re-edit your hours.
          </p>
        </div>
      </div>

      {travels.length > 0 ? (
        <ul className="space-y-1.5">
          {travels.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{t.timeZone.replace(/_/g, " ")}</span>{" "}
                <span className="text-muted-foreground">
                  · {formatDate(t.startDate)} – {formatDate(t.endDate)}
                </span>
              </span>
              <Button variant="ghost" size="icon" onClick={() => remove(t.id)} disabled={pending} aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="space-y-1">
          <Label className="text-xs">Timezone</Label>
          <Select value={tz} onValueChange={setTz}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {timeZones.map((z) => (
                <SelectItem key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Button onClick={add} disabled={pending}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </Card>
  );
}
