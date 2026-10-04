"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedLinks } from "@/components/ui/segmented";
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
import { cn } from "@/lib/utils";
import { PageHeader } from "@/app/dashboard/_components/page-header";
import { DeleteScheduleButton } from "./delete-schedule-button";
import { weekdayLabel } from "@/lib/format";
import { listTimeZones } from "@/lib/timezones";
import {
  saveScheduleAction,
  createScheduleAction,
  duplicateScheduleAction,
  setDefaultScheduleAction,
} from "./actions";

export type Interval = { start: string; end: string };
export type WeeklyRule = { day: number; intervals: Interval[] };
export type DateOverride = { date: string; intervals: Interval[] };

/** Sits at the end of the schedule switcher and opens the new schedule. */
function NewScheduleButton({ targetUserId }: { targetUserId?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const data = new FormData();
          if (targetUserId) data.set("targetUserId", String(targetUserId));
          const res = await createScheduleAction(data);
          if (res.ok && res.id) {
            const params = new URLSearchParams();
            if (targetUserId) params.set("user", String(targetUserId));
            params.set("schedule", String(res.id));
            router.push(`/dashboard/availability?${params.toString()}` as never);
          }
        })
      }
    >
      <Plus /> New schedule
    </Button>
  );
}

function formatOverrideDate(key: string): string {
  return new Date(`${key}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type Props = {
  schedule: { id: number; name: string; timeZone: string };
  /** every schedule the target user has, for the switcher */
  schedules?: { id: number; name: string; isDefault: boolean }[];
  initialWeekly: WeeklyRule[];
  initialOverrides: DateOverride[];
  /** 0=Sunday .. 6=Saturday, from the viewer's profile */
  weekStart?: number;
  /** set when an owner/admin is editing someone else's hours */
  targetUserId?: number;
  targetName?: string;
  /** team roster for the admin member selector */
  members?: { id: number; name: string }[];
  viewerId?: number;
};

export function AvailabilityEditor({
  schedule,
  schedules = [],
  initialWeekly,
  initialOverrides,
  weekStart = 0,
  targetUserId,
  targetName,
  members = [],
  viewerId,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const timezones = useMemo(() => listTimeZones(), []);

  function scheduleHref(overrides: { schedule?: number; user?: number | null }) {
    const params = new URLSearchParams();
    const userParam = overrides.user === undefined ? targetUserId : overrides.user ?? undefined;
    if (userParam) params.set("user", String(userParam));
    if (overrides.schedule) params.set("schedule", String(overrides.schedule));
    const qs = params.toString();
    return `/dashboard/availability${qs ? `?${qs}` : ""}`;
  }

  function withTarget(data: FormData): FormData {
    if (targetUserId) data.set("targetUserId", String(targetUserId));
    return data;
  }

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
        const res = await saveScheduleAction({ scheduleId: schedule.id, name, timeZone, weekly, overrides, targetUserId });
        if (res.ok) {
          toast({ title: "Changes saved", description: "Your availability has been updated." });
          router.refresh();
        } else {
          toast({ variant: "destructive", title: "Couldn't save changes", description: res.error });
        }
      } catch {
        toast({
          variant: "destructive",
          title: "Couldn't save changes",
          description: "Please try again.",
        });
      }
    });
  }

  const active = schedules.find((s) => s.id === schedule.id);
  const orderedWeek = [...weekly].sort(
    (a, b) => ((a.day - weekStart + 7) % 7) - ((b.day - weekStart + 7) % 7),
  );

  function updateOverrideInterval(date: string, idx: number, key: keyof Interval, value: string) {
    setOverrides((o) =>
      o.map((x) =>
        x.date === date
          ? { ...x, intervals: x.intervals.map((y, j) => (j === idx ? { ...y, [key]: value } : y)) }
          : x,
      ),
    );
  }

  function toggleOverrideHours(date: string) {
    setOverrides((o) =>
      o.map((x) =>
        x.date === date
          ? { ...x, intervals: x.intervals.length ? [] : [{ start: "09:00", end: "17:00" }] }
          : x,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability"
        description={
          targetName
            ? `Editing ${targetName}'s bookable hours.`
            : "Set the hours people can book you."
        }
        action={
          <Button onClick={save} loading={pending}>
            <Check /> Save
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {members.length > 1 ? (
          <Select
            value={String(targetUserId ?? viewerId ?? "")}
            onValueChange={(value) => {
              const id = Number(value);
              router.push(scheduleHref({ user: id === viewerId ? null : id, schedule: undefined }) as Parameters<typeof router.push>[0]);
            }}
          >
            <SelectTrigger aria-label="Whose availability" className="w-auto min-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {members.map((member) => (
                <SelectItem key={member.id} value={String(member.id)}>
                  {member.id === viewerId ? `${member.name} (you)` : member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <SegmentedLinks
          aria-label="Schedules"
          items={schedules.map((s) => ({
            href: scheduleHref({ schedule: s.id }),
            active: s.id === schedule.id,
            label: (
              <>
                {s.name}
                {s.isDefault ? <span className="text-meta font-normal text-muted-foreground">Default</span> : null}
              </>
            ),
          }))}
        />
        <NewScheduleButton targetUserId={targetUserId} />
      </div>

      <div>
        <FormSection
          title="Weekly hours"
          description={
            <>
              Times are in {timeZone.replace(/_/g, " ")}. Each{" "}
              <Link href="/dashboard/services" className="font-medium text-foreground underline-offset-4 hover:underline">
                service
              </Link>{" "}
              adds its own buffers, notice and slot spacing inside these hours.
            </>
          }
          contentClassName="gap-0 p-0"
        >
          <div className="divide-y">
            {orderedWeek.map((rule) => {
              const enabled = rule.intervals.length > 0;
              const dayName = weekdayLabel(rule.day);
              return (
                <div key={rule.day} className={ROW_CLASS}>
                  <div className="flex h-9 items-center gap-3">
                    <Switch id={`day-${rule.day}`} checked={enabled} onCheckedChange={(c) => toggleDay(rule.day, c)} />
                    <Label htmlFor={`day-${rule.day}`}>{dayName}</Label>
                  </div>
                  {enabled ? (
                    <div className={INTERVALS_CLASS}>
                      {rule.intervals.map((iv, i) => (
                        <TimeRange
                          key={i}
                          label={dayName}
                          interval={iv}
                          onChange={(key, value) => updateInterval(rule.day, i, key, value)}
                          action={
                            <Tooltip content="Remove">
                              <Button variant="ghost" size="icon-sm" aria-label="Remove hours" onClick={() => removeInterval(rule.day, i)}>
                                <X />
                              </Button>
                            </Tooltip>
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="hidden h-9 items-center text-sm text-muted-foreground sm:flex">Unavailable</p>
                  )}
                  {enabled ? (
                    <div className="flex h-9 items-center gap-1 justify-self-end">
                      <Tooltip content="Add interval">
                        <Button variant="ghost" size="icon-sm" aria-label="Add interval" onClick={() => addInterval(rule.day)}>
                          <Plus />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Copy to all days">
                        <Button variant="ghost" size="icon-sm" aria-label="Copy to all days" onClick={() => copyToAll(rule.day)}>
                          <Copy />
                        </Button>
                      </Tooltip>
                    </div>
                  ) : (
                    <p className="flex h-9 items-center justify-self-end text-meta text-muted-foreground sm:hidden">Unavailable</p>
                  )}
                </div>
              );
            })}
          </div>
        </FormSection>

        <FormSection
          title="Date overrides"
          description="Add hours or block specific dates."
          contentClassName="gap-0 p-0"
        >
          <div className="flex flex-wrap items-center gap-2 p-5">
            <Input
              type="date"
              aria-label="Override date"
              value={newDate}
              min={new Date().toISOString().slice(0, 10)}
              className="w-auto flex-1 sm:w-44 sm:flex-none"
              onChange={(e) => setNewDate(e.target.value)}
            />
            <Button variant="outline" onClick={addOverride} disabled={!newDate} aria-label="Add override">
              <Plus /> Add override
            </Button>
          </div>
          {overrides.length > 0 ? (
            <div className="divide-y border-t">
              {overrides.map((ov) => (
                <div key={ov.date} className={ROW_CLASS}>
                  <p className="flex h-9 items-center text-sm font-medium tabular-nums">{formatOverrideDate(ov.date)}</p>
                  {ov.intervals.length === 0 ? (
                    <p className={cn(INTERVALS_CLASS, "flex h-9 items-center text-sm text-muted-foreground")}>Unavailable</p>
                  ) : (
                    <div className={INTERVALS_CLASS}>
                      {ov.intervals.map((iv, i) => (
                        <TimeRange
                          key={i}
                          label={formatOverrideDate(ov.date)}
                          interval={iv}
                          onChange={(key, value) => updateOverrideInterval(ov.date, i, key, value)}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex h-9 items-center gap-1 justify-self-end">
                    <Button variant="ghost" size="sm" onClick={() => toggleOverrideHours(ov.date)}>
                      {ov.intervals.length ? "Mark unavailable" : "Add hours"}
                    </Button>
                    <Tooltip content="Remove override">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove override"
                        onClick={() => setOverrides((o) => o.filter((x) => x.date !== ov.date))}
                      >
                        <Trash2 />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </FormSection>

        <FormSection
          title="Schedule"
          description="Name this schedule and choose the timezone its hours are in."
          footer={
            <>
              <div className="mr-auto">
                <DeleteScheduleButton scheduleId={schedule.id} scheduleName={name} targetUserId={targetUserId} />
              </div>
              {active && !active.isDefault ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const data = withTarget(new FormData());
                      data.set("scheduleId", String(schedule.id));
                      await setDefaultScheduleAction(data);
                      toast({ title: "Default schedule updated", description: "Public bookings now use this schedule." });
                      router.refresh();
                    })
                  }
                >
                  <Star /> Make default
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const data = withTarget(new FormData());
                    data.set("scheduleId", String(schedule.id));
                    const res = await duplicateScheduleAction(data);
                    if (res.ok && res.id) {
                      toast({ title: "Schedule duplicated" });
                      router.push(scheduleHref({ schedule: res.id }) as never);
                    }
                  })
                }
              >
                <Copy /> Duplicate
              </Button>
            </>
          }
        >
          <div className="grid items-start gap-5 sm:grid-cols-2">
            <Field label="Name" htmlFor="schedule-name">
              <Input id="schedule-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Timezone" htmlFor="schedule-timezone" hint="All hours on this page are wall-clock times in this timezone.">
              <Select value={timeZone} onValueChange={setTimeZone}>
                <SelectTrigger id="schedule-timezone">
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
            </Field>
          </div>
        </FormSection>
      </div>
    </div>
  );
}

/*
 * Weekly days and date overrides share one row grid so their columns line up:
 * label, time ranges, actions. On phones the ranges drop below the label row.
 */
const ROW_CLASS =
  "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 px-5 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto]";
const INTERVALS_CLASS = "order-last col-span-2 space-y-2 sm:order-none sm:col-span-1";

function TimeRange({
  label,
  interval,
  onChange,
  action,
}: {
  label: string;
  interval: Interval;
  onChange: (key: keyof Interval, value: string) => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="time"
        aria-label={`${label} start`}
        value={interval.start}
        className="min-w-0 flex-1 tabular-nums sm:w-32 sm:flex-none"
        onChange={(e) => onChange("start", e.target.value)}
      />
      <span aria-hidden className="text-muted-foreground">
        –
      </span>
      <Input
        type="time"
        aria-label={`${label} end`}
        value={interval.end}
        className="min-w-0 flex-1 tabular-nums sm:w-32 sm:flex-none"
        onChange={(e) => onChange("end", e.target.value)}
      />
      {action}
    </div>
  );
}
