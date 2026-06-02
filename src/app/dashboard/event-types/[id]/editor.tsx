"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Plus, Trash2, GripVertical } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { LOCATION_OPTIONS } from "@/lib/locations";
import { updateEventTypeAction } from "../actions";

type Props = {
  eventType: EventType;
  username: string;
  resources: { id: number; name: string; type: string; capacity: number }[];
  selectedResourceIds: number[];
};

export function EventTypeEditor({ eventType, username, resources, selectedResourceIds }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const initialForm = {
    title: eventType.title,
    slug: eventType.slug,
    description: eventType.description ?? "",
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
    successRedirectUrl: eventType.successRedirectUrl ?? "",
  };

  const [form, setForm] = useState(initialForm);
  const [locations, setLocations] = useState<EventLocation[]>(eventType.locations ?? []);
  const [fields, setFields] = useState<BookingField[]>(eventType.bookingFields ?? []);
  const [resourceIds, setResourceIds] = useState<number[]>(selectedResourceIds);

  // Track whether the form is dirty (different from initial)
  const initial = JSON.stringify({ form: initialForm, locations: eventType.locations ?? [], fields: eventType.bookingFields ?? [], resourceIds: selectedResourceIds });
  const dirty = JSON.stringify({ form, locations, fields, resourceIds }) !== initial;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tooltip content="Back to event types">
            <Button asChild variant="ghost" size="icon">
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </Tooltip>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{form.title}</h1>
            <p className="text-sm text-muted-foreground">
              /{username}/{form.slug}
            </p>
          </div>
        </div>
        <Button onClick={save} loading={pending}>
          <Check className="h-4 w-4" /> Save
        </Button>
      </div>

      <Tabs defaultValue="setup">
        <TabsList>
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="limits">Limits</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* SETUP */}
        <TabsContent value="setup" className="space-y-5">
          <Section title="Details">
            <Field label="Title">
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="URL slug">
              <div className="flex items-center rounded-md border border-input pl-3 text-sm text-muted-foreground">
                <span className="select-none">/{username}/</span>
                <input
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
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
          </Section>

          <Section title="Duration">
            <Field label="Default length (minutes)">
              <Input
                type="number"
                min={5}
                value={form.length}
                onChange={(e) => set("length", Number(e.target.value))}
                className="w-32"
              />
            </Field>
          </Section>

          <Section title="Location" description="Where the meeting takes place.">
            <div className="space-y-2">
              {locations.map((loc, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    value={loc.type}
                    onValueChange={(v) =>
                      setLocations((ls) => ls.map((l, j) => (j === i ? ({ type: v } as EventLocation) : l)))
                    }
                  >
                    <SelectTrigger className="w-72">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATION_OPTIONS.map((o) => (
                        <SelectItem key={o.type} value={o.type}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {loc.type === "in_person" && (
                    <Input
                      placeholder="Address"
                      value={loc.address ?? ""}
                      onChange={(e) =>
                        setLocations((ls) =>
                          ls.map((l, j) => (j === i ? { type: "in_person", address: e.target.value } : l)),
                        )
                      }
                    />
                  )}
                  {loc.type === "link" && (
                    <Input
                      placeholder="https://…"
                      value={loc.link ?? ""}
                      onChange={(e) =>
                        setLocations((ls) =>
                          ls.map((l, j) => (j === i ? { type: "link", link: e.target.value } : l)),
                        )
                      }
                    />
                  )}
                  {loc.type === "phone" && (
                    <Input
                      placeholder="Your phone number"
                      value={loc.phone ?? ""}
                      onChange={(e) =>
                        setLocations((ls) =>
                          ls.map((l, j) => (j === i ? { type: "phone", phone: e.target.value } : l)),
                        )
                      }
                    />
                  )}
                  <Tooltip content="Remove location">
                    <Button variant="ghost" size="icon" onClick={() => setLocations((ls) => ls.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocations((ls) => [...ls, { type: "google_meet" }])}
              >
                <Plus className="h-4 w-4" /> Add location
              </Button>
            </div>
          </Section>
        </TabsContent>

        {/* LIMITS */}
        <TabsContent value="limits" className="space-y-5">
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
          <Section title="Booking questions" description="What attendees fill in when booking.">
            <div className="space-y-2">
              {fields.map((f, i) => {
                const hasOptions = f.type === "select" || f.type === "radio" || f.type === "multiselect";
                const priorFields = fields.filter((p, j) => j < i && p.name !== f.name);
                return (
                  <div key={i} className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
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
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["text", "textarea", "email", "phone", "number", "select", "radio", "checkbox", "multiselect", "file"].map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
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
                      {!f.system && (
                        <Tooltip content="Remove question">
                          <Button variant="ghost" size="icon" onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                      )}
                    </div>

                    <div className="flex items-center gap-3 pl-6">
                      <Input
                        className="h-8 flex-1"
                        placeholder="Placeholder text (optional)"
                        value={f.placeholder ?? ""}
                        onChange={(e) =>
                          setFields((fs) => fs.map((x, j) => (j === i ? { ...x, placeholder: e.target.value || undefined } : x)))
                        }
                      />
                      {f.name !== "name" && f.name !== "email" && (
                        <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                          <Switch
                            checked={f.hidden ?? false}
                            onCheckedChange={(c) => setFields((fs) => fs.map((x, j) => (j === i ? { ...x, hidden: c || undefined } : x)))}
                          />
                          Hidden
                        </label>
                      )}
                    </div>

                    {hasOptions && (
                      <div className="pl-6">
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
                      <div className="flex flex-wrap items-center gap-2 pl-6 text-xs text-muted-foreground">
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
                          <SelectTrigger className="h-8 w-40">
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
                        {f.showWhen && (
                          <>
                            <span>equals</span>
                            <Input
                              className="h-8 w-48"
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
                        )}
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

        {/* ADVANCED */}
        <TabsContent value="advanced" className="space-y-5">
          <Section title="Booking behaviour">
            <Toggle
              label="Requires confirmation"
              description="You approve each booking before it's confirmed."
              checked={form.requiresConfirmation}
              onChange={(c) => set("requiresConfirmation", c)}
            />
            <Separator />
            <Toggle
              label="Hide from your public page"
              description="Only reachable via direct link."
              checked={form.hidden}
              onChange={(c) => set("hidden", c)}
            />
            <Separator />
            <Toggle
              label="Disable guests"
              description="Attendees can't add extra guests."
              checked={form.disableGuests}
              onChange={(c) => set("disableGuests", c)}
            />
          </Section>

          <Section title="Payment" description="Charge attendees to book (Stripe).">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Price (cents, 0 = free)">
                <Input type="number" min={0} value={form.price} onChange={(e) => set("price", Number(e.target.value))} />
              </Field>
              <Field label="Currency">
                <Input value={form.currency} maxLength={3} onChange={(e) => set("currency", e.target.value.toLowerCase())} />
              </Field>
            </div>
          </Section>

          <Section title="After booking">
            <Field label="Redirect URL (optional)">
              <Input
                placeholder="https://…"
                value={form.successRedirectUrl}
                onChange={(e) => set("successRedirectUrl", e.target.value)}
              />
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
    <div className="rounded-xl border bg-card p-5">
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
