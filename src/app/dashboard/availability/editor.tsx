"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/app/dashboard/_components/page-header";
import { DeleteScheduleButton } from "./delete-schedule-button";
import { weekdayLabel } from "@/lib/format";
import { listTimeZones } from "@/lib/timezones";
import { saveScheduleAction } from "./actions";

export type Interval = { start: string; end: string };
export type WeeklyRule = { day: number; intervals: Interval[] };
export type DateOverride = { date: string; intervals: Interval[] };

type Props = {
  schedule: { id: number; name: string; timeZone: string };
  initialWeekly: WeeklyRule[];
  initialOverrides: DateOverride[];
};

export function AvailabilityEditor({ schedule, initialWeekly, initialOverrides }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const timezones = useMemo(() => listTimeZones(), []);

  const [name, setName] = useState(schedule.name);
  const [timeZone, setTimeZone] = useState(schedule.timeZone);
  const [weekly, setWeekly] = useState<WeeklyRule[]>(initialWeekly);
  const [overrides, setOverrides] = useState<DateOverride[]>(initialOverrides);
  const [newDate, setNewDate] = useState("");

  function toggleDay(day: number, enabled: boolean) {
    setWeekly((w) =>
      w.map((r) =>
        r.day === day
          ? { ...r, intervals: enabled ? (r.intervals.length ? r.intervals : [{ start: "09:00", end: "17:00" }]) : [] }
          : r,
      ),
    );
  }

  function updateInterval(day: number, idx: number, key: keyof Interval, value: string) {
    setWeekly((w) =>
      w.map((r) =>
        r.day === day
          ? { ...r, intervals: r.intervals.map((iv, i) => (i === idx ? { ...iv, [key]: value } : iv)) }
          : r,
      ),
    );
  }

  function addInterval(day: number) {
    setWeekly((w) =>
      w.map((r) => (r.day === day ? { ...r, intervals: [...r.intervals, { start: "09:00", end: "17:00" }] } : r)),
    );
  }

  function removeInterval(day: number, idx: number) {
    setWeekly((w) =>
      w.map((r) => (r.day === day ? { ...r, intervals: r.intervals.filter((_, i) => i !== idx) } : r)),
    );
  }

  function copyToAll(day: number) {
    const source = weekly.find((r) => r.day === day)?.intervals ?? [];
    setWeekly((w) => w.map((r) => ({ ...r, intervals: source.map((iv) => ({ ...iv })) })));
  }

  function addOverride() {
    if (!newDate || overrides.some((o) => o.date === newDate)) return;
    setOverrides((o) => [...o, { date: newDate, intervals: [{ start: "09:00", end: "17:00" }] }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewDate("");
  }

  function save() {
    start(async () => {
      try {
        await saveScheduleAction({ scheduleId: schedule.id, name, timeZone, weekly, overrides });
        toast({ title: "Changes saved", description: "Your availability has been updated." });
        router.refresh();
      } catch {
        toast({
          variant: "destructive",
          title: "Couldn't save changes",
          description: "Please try again.",
        });
      }
    });
  }

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Availability"
        description="Set the hours people can book you."
        action={
          <Button onClick={save} loading={pending}>
            <Check className="h-4 w-4" /> Save
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Weekly hours</h3>
          <div className="space-y-1">
            {weekly.map((rule) => {
              const enabled = rule.intervals.length > 0;
              return (
                <div key={rule.day} className="flex flex-col gap-3 border-b py-3 last:border-0 sm:flex-row sm:items-start sm:gap-4">
                  <div className="flex w-32 shrink-0 items-center gap-2 pt-1.5">
                    <Switch checked={enabled} onCheckedChange={(c) => toggleDay(rule.day, c)} />
                    <span className="text-sm font-medium">{weekdayLabel(rule.day).slice(0, 3)}</span>
                  </div>
                  <div className="flex-1 space-y-2">
                    {!enabled ? (
                      <span className="inline-block pt-1.5 text-sm text-muted-foreground">Unavailable</span>
                    ) : (
                      rule.intervals.map((iv, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={iv.start}
                            className="w-28 min-w-0 flex-1 sm:flex-none"
                            onChange={(e) => updateInterval(rule.day, i, "start", e.target.value)}
                          />
                          <span className="text-muted-foreground">–</span>
                          <Input
                            type="time"
                            value={iv.end}
                            className="w-28 min-w-0 flex-1 sm:flex-none"
                            onChange={(e) => updateInterval(rule.day, i, "end", e.target.value)}
                          />
                          <Tooltip content="Remove">
                            <Button variant="ghost" size="icon" onClick={() => removeInterval(rule.day, i)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                        </div>
                      ))
                    )}
                  </div>
                  {enabled && (
                    <div className="flex shrink-0 items-center gap-1 pt-0.5">
                      <Tooltip content="Add interval">
                        <Button variant="ghost" size="icon" onClick={() => addInterval(rule.day)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Copy to all days">
                        <Button variant="ghost" size="icon" onClick={() => copyToAll(rule.day)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold">Schedule</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Select value={timeZone} onValueChange={setTimeZone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {timezones.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 border-t border-border/40 pt-3">
              <DeleteScheduleButton scheduleId={schedule.id} scheduleName={name} />
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="mb-1 text-sm font-semibold">Date overrides</h3>
            <p className="mb-3 text-sm text-muted-foreground">Add hours or block specific dates.</p>
            <div className="flex items-center gap-2">
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              <Button variant="outline" size="icon" onClick={addOverride}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 space-y-3">
              {overrides.map((ov) => (
                <div key={ov.date} className="rounded-md border border-border bg-secondary/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{ov.date}</span>
                  <Tooltip content="Remove override">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setOverrides((o) => o.filter((x) => x.date !== ov.date))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                  </div>
                  {ov.intervals.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Unavailable</span>
                  ) : (
                    ov.intervals.map((iv, i) => (
                      <div key={i} className="mb-1.5 flex items-center gap-2">
                        <Input
                          type="time"
                          value={iv.start}
                          className="w-24 min-w-0 flex-1 sm:flex-none"
                          onChange={(e) =>
                            setOverrides((o) =>
                              o.map((x) =>
                                x.date === ov.date
                                  ? { ...x, intervals: x.intervals.map((y, j) => (j === i ? { ...y, start: e.target.value } : y)) }
                                  : x,
                              ),
                            )
                          }
                        />
                        <span className="text-muted-foreground">–</span>
                        <Input
                          type="time"
                          value={iv.end}
                          className="w-24 min-w-0 flex-1 sm:flex-none"
                          onChange={(e) =>
                            setOverrides((o) =>
                              o.map((x) =>
                                x.date === ov.date
                                  ? { ...x, intervals: x.intervals.map((y, j) => (j === i ? { ...y, end: e.target.value } : y)) }
                                  : x,
                              ),
                            )
                          }
                        />
                      </div>
                    ))
                  )}
                  <button
                    className="mt-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setOverrides((o) =>
                        o.map((x) =>
                          x.date === ov.date
                            ? { ...x, intervals: x.intervals.length ? [] : [{ start: "09:00", end: "17:00" }] }
                            : x,
                        ),
                      )
                    }
                  >
                    {ov.intervals.length ? "Mark unavailable" : "Add hours"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
