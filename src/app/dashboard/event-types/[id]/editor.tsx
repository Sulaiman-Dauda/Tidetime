"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowDown, ArrowUp, Check, Plus, Trash2, AlertTriangle } from "lucide-react";
import type { EventType, EventLocation, BookingField } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip } from "@/components/ui/tooltip";
import { DeleteEventButton } from "../../_components/delete-event-button";
import { CopyLinkButton } from "../../_components/copy-link-button";
import { useToast } from "@/hooks/use-toast";
import { LOCATION_OPTIONS, isUnsupportedLocationType, locationOption } from "@/lib/locations";
import { updateEventTypeAction } from "../actions";

type Props = {
  eventType: EventType;
  username: string;
  appUrl: string;
  resources: { id: number; name: string; type: string; capacity: number }[];
  selectedResourceIds: number[];
  categories: { id: number; name: string }[];
};

const BOOKING_FIELD_TYPE_OPTIONS: Array<{ value: BookingField["type"]; label: string }> = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "select", label: "Select" },
  { value: "radio", label: "Single choice" },
  { value: "checkbox", label: "Checkbox" },
  { value: "multiselect", label: "Multiple choice" },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "meeting";
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function parseAdditionalDurations(value: string, defaultLength: number): number[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => Number(entry.trim()))
        .filter((n) => Number.isFinite(n) && n >= 5 && n <= 1440 && n !== defaultLength)
        .map((n) => Math.round(n)),
    ),
  ).sort((a, b) => a - b);
}

export function EventTypeEditor({ eventType, username, appUrl, resources, selectedResourceIds, categories }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const initialForm = {
    title: eventType.title,
    slug: eventType.slug,
    description: eventType.description ?? "",
    categoryId: (eventType.categoryId ?? null) as number | null,
    length: eventType.length,
    durations: eventType.durations ?? [],
    hidden: eventType.hidden,
    beforeEventBuffer: eventType.beforeEventBuffer,
    afterEventBuffer: eventType.afterEventBuffer,
    minimumBookingNotice: eventType.minimumBookingNotice,
    slotInterval: eventType.slotInterval,
    offsetStart: eventType.offsetStart,
    seatsPerTimeSlot: eventType.seatsPerTimeSlot,
    requiresConfirmation: eventType.requiresConfirmation,
    disableGuests: eventType.disableGuests,
    recurringEnabled: Boolean(eventType.recurringEvent),
    recurringFreq: eventType.recurringEvent?.freq ?? "weekly",
    recurringInterval: eventType.recurringEvent?.interval ?? 1,
    recurringCount: eventType.recurringEvent?.count ?? 4,
    periodType: eventType.periodType,
    periodDays: eventType.periodDays,
    price: eventType.price,
    currency: eventType.currency,
    requiresPayment: eventType.requiresPayment,
    depositAmount: eventType.depositAmount,
    successRedirectUrl: eventType.successRedirectUrl ?? "",
  };

  const [form, setForm] = useState(initialForm);
  const [locations, setLocations] = useState<EventLocation[]>(eventType.locations ?? []);
  const [fields, setFields] = useState<BookingField[]>(eventType.bookingFields ?? []);
  const [resourceIds, setResourceIds] = useState<number[]>(selectedResourceIds);

  const publicUrl = `${appUrl}/${username}/${form.slug}`;

  // Track whether the form is dirty (different from initial)
  const initial = JSON.stringify({ form: initialForm, locations: eventType.locations ?? [], fields: eventType.bookingFields ?? [], resourceIds: selectedResourceIds });
  const dirty = JSON.stringify({ form, locations, fields, resourceIds }) !== initial;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setTitle(value: string) {
    set("title", value);
  }

  function setSlug(value: string) {
    set("slug", slugify(value));
  }

  function save() {
    start(async () => {
      try {
        const result = await updateEventTypeAction({
          id: eventType.id,
          ...form,
          successRedirectUrl: form.successRedirectUrl || null,
          recurringEvent: form.recurringEnabled
            ? {
                freq: form.recurringFreq as "weekly" | "monthly",
                interval: form.recurringInterval,
                count: form.recurringCount,
              }
            : null,
          locations,
          bookingFields: fields,
          bookingLimits: eventType.bookingLimits ?? null,
          resourceIds,
        });
        if (!result.ok) {
          throw new Error(result.error);
        }
        toast({ title: "Saved", description: "Your event type has been updated." });
        router.refresh();
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Couldn't save",
          description:
            error instanceof Error ? error.message : "Please check your inputs and try again.",
        });
      }
    });
  }

  return (
    <div className="animate-fade-in space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Tooltip content="Back to services">
              <Button asChild variant="ghost" size="icon">
                <Link href="/dashboard/event-types">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </Tooltip>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{form.title}</h1>
              <p className="text-sm text-muted-foreground">
                This is the page people book from.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CopyLinkButton url={publicUrl} label={`/${username}/${form.slug}`} />
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${form.hidden ? "bg-secondary text-muted-foreground" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}>
              {form.hidden ? "Hidden from public page" : "Publicly bookable"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start">
          <DeleteEventButton id={eventType.id} label={form.title} />
          <Button onClick={save} loading={pending}>
            <Check className="h-4 w-4" /> Save
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basics">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="questions">Booking form</TabsTrigger>
          <TabsTrigger value="more">More</TabsTrigger>
        </TabsList>

        {/* BASICS */}
        <TabsContent value="basics" className="space-y-5">
          <Section title="Details" description="Start with the essentials people see before they book.">
            <Field label="Title">
              <Input value={form.title} onChange={(e) => setTitle(e.target.value)} placeholder="30 Minute Consultation" />
            </Field>
            <Field label="URL slug">
              <div className="flex items-center rounded-md border border-input pl-3 text-sm text-muted-foreground">
                <span className="select-none">/{username}/</span>
                <input
                  value={form.slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="h-9 flex-1 bg-transparent px-1 text-foreground outline-none"
                />
              </div>
            </Field>
            <Field label="Description">
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="A short description shown on the booking page."
              />
            </Field>
            {categories.length > 0 && (
              <Field label="Category">
                <Select
                  value={form.categoryId === null ? "__none" : String(form.categoryId)}
                  onValueChange={(value) => set("categoryId", value === "__none" ? null : Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Uncategorised" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Uncategorised</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Toggle
              label="Show on your public booking page"
              description="Turn this off if you only want to share the direct link manually."
              checked={!form.hidden}
              onChange={(checked) => set("hidden", !checked)}
            />
          </Section>

          <Section title="Duration" description="Offer one default duration or a few sensible choices.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Default length (minutes)">
                <Input
                  type="number"
                  min={5}
                  value={form.length}
                  onChange={(e) => {
                    const nextLength = Number(e.target.value);
                    set("length", nextLength);
                    set("durations", form.durations.filter((d) => d !== nextLength));
                  }}
                  className="w-32"
                />
              </Field>
              <Field label="Extra bookable lengths (optional)">
                <Input
                  value={form.durations.join(", ")}
                  onChange={(e) => set("durations", parseAdditionalDurations(e.target.value, form.length))}
                  placeholder="15, 45, 60"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated minutes. The default length stays available automatically.
                </p>
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              {[form.length, ...form.durations].sort((a, b) => a - b).map((minutes) => (
                <span
                  key={minutes}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${minutes === form.length ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
                >
                  {minutes} min{minutes === form.length ? " · default" : ""}
                </span>
              ))}
            </div>
          </Section>

          <Section
            title="Location"
            description="Choose from the location types Tidetime supports today. Use a custom link for video calls."
          >
            <div className="space-y-3">
              {locations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No location yet. Add one so attendees know where to meet.</p>
              ) : null}
              {locations.map((loc, i) => {
                const currentOption = locationOption(loc.type);
                const options = currentOption && isUnsupportedLocationType(loc.type)
                  ? [currentOption, ...LOCATION_OPTIONS]
                  : LOCATION_OPTIONS;
                return (
                  <div key={i} className="space-y-2 rounded-xl border border-border/60 p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                      <Select
                        value={loc.type}
                        onValueChange={(v) =>
                          setLocations((ls) =>
                            ls.map((l, j) =>
                              j === i
                                ? v === "in_person"
                                  ? { type: "in_person", address: "" }
                                  : v === "phone"
                                    ? { type: "phone", phone: "" }
                                    : v === "link"
                                      ? { type: "link", link: "" }
                                      : ({ type: v } as EventLocation)
                                : l,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="w-full md:w-72">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((o) => (
                            <SelectItem key={o.type} value={o.type}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {loc.type === "in_person" ? (
                        <Input
                          placeholder="Address"
                          value={loc.address ?? ""}
                          onChange={(e) =>
                            setLocations((ls) =>
                              ls.map((l, j) => (j === i ? { type: "in_person", address: e.target.value } : l)),
                            )
                          }
                        />
                      ) : loc.type === "link" ? (
                        <Input
                          placeholder="https://…"
                          value={loc.link ?? ""}
                          onChange={(e) =>
                            setLocations((ls) =>
                              ls.map((l, j) => (j === i ? { type: "link", link: e.target.value } : l)),
                            )
                          }
                        />
                      ) : loc.type === "phone" ? (
                        <Input
                          placeholder="Your phone number"
                          value={loc.phone ?? ""}
                          onChange={(e) =>
                            setLocations((ls) =>
                              ls.map((l, j) => (j === i ? { type: "phone", phone: e.target.value } : l)),
                            )
                          }
                        />
                      ) : loc.type === "attendee_phone" ? (
                        <div className="flex-1 rounded-md border border-dashed border-border/60 px-3 py-2 text-sm text-muted-foreground">
                          The attendee provides the call number during booking.
                        </div>
                      ) : (
                        <div className="flex-1 rounded-md border border-dashed border-border/60 px-3 py-2 text-sm text-muted-foreground">
                          This provider is kept for legacy data only and is not connected in Tidetime.
                        </div>
                      )}
                      <Tooltip content="Remove location">
                        <Button variant="ghost" size="icon" onClick={() => setLocations((ls) => ls.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                    </div>
                    {isUnsupportedLocationType(loc.type) ? (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>
                          Google Meet and Zoom accounts are not connected in Tidetime yet. Replace this with a custom link or a phone/in-person location.
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocations((ls) => [...ls, { type: "link", link: "" }])}
              >
                <Plus className="h-4 w-4" /> Add location
              </Button>
            </div>
          </Section>
        </TabsContent>

        {/* AVAILABILITY */}
        <TabsContent value="availability" className="space-y-5">
          <Section title="Buffers" description="Block time around your meetings.">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Before event (min)">
                <Input type="number" min={0} value={form.beforeEventBuffer} onChange={(e) => set("beforeEventBuffer", Number(e.target.value))} />
              </Field>
              <Field label="After event (min)">
                <Input type="number" min={0} value={form.afterEventBuffer} onChange={(e) => set("afterEventBuffer", Number(e.target.value))} />
              </Field>
            </div>
          </Section>

          <Section title="Notice & slots">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Minimum notice (min)">
                <Input type="number" min={0} value={form.minimumBookingNotice} onChange={(e) => set("minimumBookingNotice", Number(e.target.value))} />
              </Field>
              <Field label="Slot interval (min, optional)">
                <Input
                  type="number"
                  min={5}
                  value={form.slotInterval ?? ""}
                  placeholder={String(form.length)}
                  onChange={(e) => set("slotInterval", e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start offset (min)">
                <Input
                  type="number"
                  min={0}
                  value={form.offsetStart || ""}
                  placeholder="0"
                  onChange={(e) => set("offsetStart", e.target.value ? Number(e.target.value) : 0)}
                />
                <p className="mt-1 text-xs text-muted-foreground">Shift slot times, e.g. 15 → :15 and :45.</p>
              </Field>
            </div>
          </Section>

          <Section title="Future bookings" description="How far ahead people can book.">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Window">
                <Select value={form.periodType} onValueChange={(v) => set("periodType", v as typeof form.periodType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unlimited">Indefinitely into the future</SelectItem>
                    <SelectItem value="rolling">A rolling window of days</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {form.periodType !== "unlimited" && (
                <Field label="Days into the future">
                  <Input type="number" min={1} value={form.periodDays ?? 30} onChange={(e) => set("periodDays", Number(e.target.value))} />
                </Field>
              )}
            </div>
          </Section>

          <Section title="Group bookings" description="Allow multiple attendees per slot (e.g. classes).">
            <Field label="Seats per slot (blank = 1)">
              <Input
                type="number"
                min={1}
                className="w-32"
                value={form.seatsPerTimeSlot ?? ""}
                placeholder="1"
                onChange={(e) => set("seatsPerTimeSlot", e.target.value ? Number(e.target.value) : null)}
              />
            </Field>
          </Section>

          <Section title="Recurring" description="Let attendees book a repeating series in one go (weekly or monthly).">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.recurringEnabled} onCheckedChange={(c) => set("recurringEnabled", c)} />
              Enable recurring bookings
            </label>
            {form.recurringEnabled && (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <Field label="Frequency">
                  <Select
                    value={form.recurringFreq}
                    onValueChange={(v) => set("recurringFreq", v as "weekly" | "monthly")}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Every (interval)">
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    className="w-24"
                    value={form.recurringInterval}
                    onChange={(e) => set("recurringInterval", Math.max(1, Number(e.target.value) || 1))}
                  />
                </Field>
                <Field label="Occurrences">
                  <Input
                    type="number"
                    min={1}
                    max={52}
                    className="w-24"
                    value={form.recurringCount}
                    onChange={(e) => set("recurringCount", Math.max(1, Number(e.target.value) || 1))}
                  />
                </Field>
              </div>
            )}
          </Section>
        </TabsContent>

        {/* QUESTIONS */}
        <TabsContent value="questions" className="space-y-5">
          <Section
            title="Booking questions"
            description="Ask only what you need. Name and email stay built in so every booking is workable."
          >
            <div className="space-y-2">
              {fields.map((f, i) => {
                const hasOptions = f.type === "select" || f.type === "radio" || f.type === "multiselect";
                const priorFields = fields.filter((p, j) => j < i && p.name !== f.name);
                const typeOptions = BOOKING_FIELD_TYPE_OPTIONS;
                return (
                  <div key={i} className="space-y-3 rounded-xl border border-border/60 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground xl:w-32">
                        <span className="rounded-full border border-border/60 px-2 py-1">Field {i + 1}</span>
                        {f.system ? <span className="rounded-full bg-secondary px-2 py-1">System</span> : null}
                      </div>
                      <Input
                        className="flex-1"
                        value={f.label}
                        onChange={(e) => setFields((fs) => fs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                      />
                      <Select
                        value={f.type}
                        disabled={f.system}
                        onValueChange={(v) => setFields((fs) => fs.map((x, j) => (j === i ? { ...x, type: v as BookingField["type"] } : x)))}
                      >
                        <SelectTrigger className="w-full xl:w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {typeOptions.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Switch
                          checked={f.required}
                          onCheckedChange={(c) => setFields((fs) => fs.map((x, j) => (j === i ? { ...x, required: c } : x)))}
                        />
                        Required
                      </label>
                      {!f.system ? (
                        <div className="flex items-center gap-1 self-start xl:self-auto">
                          <Tooltip content="Move up">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={i === 0}
                              onClick={() => setFields((fs) => moveItem(fs, i, i - 1))}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                          <Tooltip content="Move down">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={i === fields.length - 1}
                              onClick={() => setFields((fs) => moveItem(fs, i, i + 1))}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                          <Tooltip content="Remove question">
                            <Button variant="ghost" size="icon" onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                      <Input
                        className="h-9"
                        placeholder="Placeholder text (optional)"
                        value={f.placeholder ?? ""}
                        onChange={(e) =>
                          setFields((fs) => fs.map((x, j) => (j === i ? { ...x, placeholder: e.target.value || undefined } : x)))
                        }
                      />
                      {f.name !== "name" && f.name !== "email" ? (
                        <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                          <Switch
                            checked={f.hidden ?? false}
                            onCheckedChange={(c) => setFields((fs) => fs.map((x, j) => (j === i ? { ...x, hidden: c || undefined } : x)))}
                          />
                          Hidden
                        </label>
                      ) : null}
                    </div>



                    {hasOptions && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Options (one per line)</Label>
                        <Textarea
                          rows={3}
                          className="mt-1"
                          value={(f.options ?? []).join("\n")}
                          placeholder={"Option A\nOption B"}
                          onChange={(e) =>
                            setFields((fs) =>
                              fs.map((x, j) =>
                                j === i
                                  ? { ...x, options: e.target.value.split("\n").map((o) => o.trim()).filter(Boolean) }
                                  : x,
                              ),
                            )
                          }
                        />
                      </div>
                    )}

                    {!f.system && priorFields.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Show only when</span>
                        <Select
                          value={f.showWhen?.field ?? "__always"}
                          onValueChange={(v) =>
                            setFields((fs) =>
                              fs.map((x, j) =>
                                j === i
                                  ? v === "__always"
                                    ? { ...x, showWhen: undefined }
                                    : { ...x, showWhen: { field: v, equals: x.showWhen?.equals ?? [] } }
                                  : x,
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__always">Always shown</SelectItem>
                            {priorFields.map((p) => (
                              <SelectItem key={p.name} value={p.name}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {f.showWhen ? (
                          <>
                            <span>equals</span>
                            <Input
                              className="h-8 w-52"
                              placeholder="value1, value2"
                              value={f.showWhen.equals.join(", ")}
                              onChange={(e) =>
                                setFields((fs) =>
                                  fs.map((x, j) =>
                                    j === i && x.showWhen
                                      ? {
                                          ...x,
                                          showWhen: {
                                            ...x.showWhen,
                                            equals: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                                          },
                                        }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setFields((fs) => [
                    ...fs,
                    { name: `q_${Date.now()}`, label: "New question", type: "text", required: false },
                  ])
                }
              >
                <Plus className="h-4 w-4" /> Add question
              </Button>
            </div>
          </Section>
        </TabsContent>

        {/* MORE */}
        <TabsContent value="more" className="space-y-5">
          <Section title="Booking behaviour" description="Extra controls that change how the service behaves.">
            <Toggle
              label="Requires confirmation"
              description="You approve each booking before it becomes confirmed."
              checked={form.requiresConfirmation}
              onChange={(c) => set("requiresConfirmation", c)}
            />
            <Separator />
            <Toggle
              label="Disable guests"
              description="Attendees can only book for themselves."
              checked={form.disableGuests}
              onChange={(c) => set("disableGuests", c)}
            />
          </Section>

          <Section
            title="Pricing & payments"
            description="Set a price and require payment before the booking is confirmed. Attendees pay securely via Stripe at checkout."
          >
            <div className="grid grid-cols-2 gap-4">
              <Field label="Price in cents (0 = free)">
                <Input type="number" min={0} value={form.price} onChange={(e) => set("price", Number(e.target.value))} />
              </Field>
              <Field label="Currency">
                <Input value={form.currency} maxLength={3} onChange={(e) => set("currency", e.target.value.toLowerCase())} />
              </Field>
            </div>
            {form.price > 0 && (
              <>
                <Separator />
                <Toggle
                  label="Require payment to confirm"
                  description="When enabled, the time slot is held but the booking is only confirmed after successful payment."
                  checked={form.requiresPayment}
                  onChange={(c) => set("requiresPayment", c)}
                />
                {form.requiresPayment && (
                  <Field label="Up-front deposit (cents, 0 = full price)">
                    <Input
                      type="number"
                      min={0}
                      max={form.price}
                      value={form.depositAmount}
                      onChange={(e) => set("depositAmount", Number(e.target.value))}
                      className="w-40"
                    />
                    <p className="text-xs text-muted-foreground">
                      Charge a deposit now with the balance due later. Leave at 0 to charge the full price.
                    </p>
                  </Field>
                )}
              </>
            )}
          </Section>

          <Section title="After booking" description="Optionally send attendees to a thank-you or intake page after they finish booking.">
            <Field label="Redirect URL (optional)">
              <Input
                placeholder="https://…"
                value={form.successRedirectUrl}
                onChange={(e) => set("successRedirectUrl", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Attendees are still emailed their manage link even when you send them elsewhere after booking.
              </p>
            </Field>
          </Section>

          {resources.length > 0 ? (
            <Section
              title="Resources"
              description="Require shared resources for this event. Tidetime blocks times when they're fully booked."
            >
              <div className="space-y-2">
                {resources.map((r) => {
                  const checked = resourceIds.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      className="flex items-center justify-between rounded-md border p-3 text-sm cursor-pointer"
                    >
                      <span>
                        <span className="font-medium">{r.name}</span>{" "}
                        <span className="text-muted-foreground">
                          ({r.type} · capacity {r.capacity})
                        </span>
                      </span>
                      <Switch
                        checked={checked}
                        onCheckedChange={(c) =>
                          setResourceIds((ids) =>
                            c ? [...ids, r.id] : ids.filter((id) => id !== r.id),
                          )
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </Section>
          ) : null}
        </TabsContent>
      </Tabs>

      {/* Sticky save bar */}
      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-4 border-t border-border bg-card/95 px-6 py-3 backdrop-blur-sm md:left-[220px]">
          <p className="text-sm text-muted-foreground">You have unsaved changes</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              setForm(initialForm);
              setLocations(eventType.locations ?? []);
              setFields(eventType.bookingFields ?? []);
              setResourceIds(selectedResourceIds);
            }}>
              Discard
            </Button>
            <Button size="sm" onClick={save} loading={pending}>
              <Check className="h-4 w-4" /> Save changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <h3 className="font-medium">{title}</h3>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
