"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { BookingField, EventLocation, Service } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Field, FieldHint } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { Input, fieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "../../_components/page-header";
import { updateServiceAction } from "../actions";

type Provider = { id: number; name: string | null; email: string; avatarUrl: string | null };
type Props = {
  service: Service;
  teamSlug: string;
  appUrl: string;
  providers: Provider[];
  selectedProviderIds: number[];
};

const LOCATION_TYPES = [
  ["jitsi", "Jitsi Meet"],
  ["google_meet", "Google Meet"],
  ["in_person", "In person"],
  ["phone", "Phone call"],
  ["attendee_phone", "Call attendee"],
  ["link", "Custom meeting link"],
] as const;

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function locationFor(type: EventLocation["type"]): EventLocation {
  if (type === "in_person") return { type, address: "" };
  if (type === "phone") return { type, phone: "" };
  if (type === "link") return { type, link: "" };
  return { type } as EventLocation;
}

export function ServiceEditor({ service, teamSlug, appUrl, providers, selectedProviderIds }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    title: service.title,
    slug: service.slug,
    description: service.description ?? "",
    length: service.length,
    durations: service.durations ?? [],
    hidden: service.hidden,
    beforeEventBuffer: service.beforeEventBuffer,
    afterEventBuffer: service.afterEventBuffer,
    minimumBookingNotice: service.minimumBookingNotice,
    slotInterval: service.slotInterval,
    seatsPerSlot: service.seatsPerSlot,
    maxBookingsPerDay: service.maxBookingsPerDay,
    requiresConfirmation: service.requiresConfirmation,
    disableGuests: service.disableGuests,
  });
  const [locations, setLocations] = useState<EventLocation[]>(service.locations.length ? service.locations : [{ type: "jitsi" }]);
  const [fields, setFields] = useState<BookingField[]>(service.bookingFields);
  const [providerIds, setProviderIds] = useState<number[]>(selectedProviderIds);
  const [draft, setDraft] = useState(service.draft);

  const publicUrl = `${appUrl}/book/${teamSlug}/${form.slug}`;

  // Unsaved-changes tracking: warn before the browser discards edits.
  const snapshot = useMemo(
    () => JSON.stringify({ form, locations, fields, providerIds, draft }),
    [form, locations, fields, providerIds, draft],
  );
  const savedSnapshot = useRef(snapshot);
  const dirty = snapshot !== savedSnapshot.current;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save(nextDraft = draft) {
    startTransition(async () => {
      const result = await updateServiceAction({
        id: service.id,
        ...form,
        draft: nextDraft,
        locations,
        bookingFields: fields,
        providerIds,
      });
      if (!result.ok) {
        toast({ title: "Couldn't save service", description: result.error, variant: "destructive" });
        return;
      }
      setDraft(nextDraft);
      savedSnapshot.current = JSON.stringify({ form, locations, fields, providerIds, draft: nextDraft });
      toast({
        title: draft && !nextDraft ? "Service published" : nextDraft ? "Service unpublished" : "Service updated",
      });
      router.refresh();
    });
  }

  function updateLocation(index: number, next: EventLocation) {
    setLocations((items) => items.map((item, i) => (i === index ? next : item)));
  }

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: "/dashboard/services", label: "Services" }}
        title={service.draft ? "New service" : form.title || "Untitled service"}
        meta={
          draft || dirty ? (
            <>
              {draft ? <Badge variant="warning" dot>Draft</Badge> : null}
              {dirty ? <Badge variant="outline">Unsaved changes</Badge> : null}
            </>
          ) : undefined
        }
        description={
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="break-all underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {publicUrl}
          </a>
        }
        action={
          <>
            {!draft ? (
              <Button
                variant="outline"
                onClick={() => save(true)}
                disabled={pending}
                title="Take the service off the public booking page while you edit"
              >
                Unpublish
              </Button>
            ) : null}
            <Button onClick={() => save(false)} disabled={pending || providerIds.length === 0 || locations.length === 0}>
              <Check /> {pending ? "Saving…" : draft ? "Publish service" : "Save"}
            </Button>
          </>
        }
      />

      <div>
        <FormSection title="Details" description="The essentials customers see before booking.">
          <Field label="Name" htmlFor="service-title">
            <Input id="service-title" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Booking URL" htmlFor="service-slug">
            <div
              className={cn(
                fieldClassName,
                "flex h-9 items-center focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/15",
              )}
            >
              <span className="min-w-0 truncate pl-3 text-muted-foreground">/book/{teamSlug}/</span>
              <input
                id="service-slug"
                className="h-full min-w-24 flex-1 bg-transparent pr-3 outline-none"
                value={form.slug}
                onChange={(e) => set("slug", slugify(e.target.value))}
              />
            </div>
          </Field>
          <Field label="Description" htmlFor="service-description">
            <Textarea
              id="service-description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
          <div className="grid items-start gap-5 sm:grid-cols-2">
            <Field label="Duration" htmlFor="service-length">
              <MinutesInput id="service-length" min={5} value={form.length} onChange={(e) => set("length", Number(e.target.value))} />
            </Field>
            <Field label="Other durations" htmlFor="service-durations" hint="Optional. Extra lengths in minutes, comma separated.">
              <Input
                id="service-durations"
                value={form.durations.join(", ")}
                onChange={(e) => set("durations", [...new Set(e.target.value.split(",").map(Number).filter((n) => n >= 5 && n <= 1440 && n !== form.length))])}
              />
            </Field>
          </div>
          <ToggleRow
            id="service-visible"
            label="Visible on company booking page"
            checked={!form.hidden}
            onChange={(value) => set("hidden", !value)}
          />
        </FormSection>

        <FormSection
          title="Providers"
          description="Bookings go to an available selected provider. With several providers, Tidetime uses least-busy round robin."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {providers.map((provider) => {
              const selected = providerIds.includes(provider.id);
              return (
                <label
                  key={provider.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring/25",
                    selected ? "border-primary bg-accent" : "hover:bg-muted/50",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selected}
                    onChange={() => setProviderIds((ids) => selected ? ids.filter((id) => id !== provider.id) : [...ids, provider.id])}
                  />
                  <Avatar className="size-8">
                    {provider.avatarUrl ? <AvatarImage src={provider.avatarUrl} alt="" /> : null}
                    <AvatarFallback>{initials(provider.name ?? provider.email)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{provider.name ?? provider.email}</span>
                    <span className="block truncate text-meta text-muted-foreground">{provider.email}</span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
                    )}
                  >
                    {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  </span>
                </label>
              );
            })}
          </div>
          {providerIds.length === 0 ? <FieldHint className="text-destructive">Assign at least one provider.</FieldHint> : null}
        </FormSection>

        <FormSection
          title="Location"
          description="Built-in Jitsi, Google Meet, a physical address, a phone call or your own link."
        >
          {locations.length > 0 ? (
            <div className="space-y-2">
              {locations.map((location, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                  <Select value={location.type} onValueChange={(value) => updateLocation(index, locationFor(value as EventLocation["type"]))}>
                    <SelectTrigger aria-label="Location type" className="flex-1 sm:w-52 sm:flex-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{LOCATION_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                  {location.type === "in_person" ? <Input className="order-last sm:order-none sm:flex-1" value={location.address} placeholder="Address" onChange={(e) => updateLocation(index, { type: "in_person", address: e.target.value })} /> : null}
                  {location.type === "phone" ? <Input className="order-last sm:order-none sm:flex-1" value={location.phone ?? ""} placeholder="Phone number" onChange={(e) => updateLocation(index, { type: "phone", phone: e.target.value })} /> : null}
                  {location.type === "link" ? <Input className="order-last sm:order-none sm:flex-1" value={location.link} type="url" placeholder="https://…" onChange={(e) => updateLocation(index, { type: "link", link: e.target.value })} /> : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="sm:ml-auto"
                    aria-label="Remove location"
                    onClick={() => setLocations((items) => items.filter((_, i) => i !== index))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <FieldHint className="text-destructive">Add at least one location.</FieldHint>
          )}
          {locations.length < 3 ? (
            <div>
              <Button variant="outline" size="sm" onClick={() => setLocations((items) => [...items, { type: "jitsi" }])}>
                <Plus /> Add location
              </Button>
            </div>
          ) : null}
        </FormSection>

        <FormSection
          title="Availability rules"
          description={
            <>
              Limits on when this service can be booked. Working hours are set on the{" "}
              <Link href="/dashboard/availability" className="font-medium text-foreground underline-offset-4 hover:underline">
                Availability
              </Link>{" "}
              page.
            </>
          }
        >
          <div className="grid items-start gap-5 sm:grid-cols-2">
            <Field label="Minimum notice" htmlFor="service-notice" hint="How far ahead people must book.">
              <MinutesInput id="service-notice" min={0} value={form.minimumBookingNotice} onChange={(e) => set("minimumBookingNotice", Number(e.target.value))} />
            </Field>
            <Field label="Slot interval" htmlFor="service-interval" hint="Time between start times. Defaults to the duration.">
              <MinutesInput id="service-interval" min={5} placeholder={String(form.length)} value={form.slotInterval ?? ""} onChange={(e) => set("slotInterval", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="Buffer before" htmlFor="service-buffer-before" hint="Kept free before each booking.">
              <MinutesInput id="service-buffer-before" min={0} value={form.beforeEventBuffer} onChange={(e) => set("beforeEventBuffer", Number(e.target.value))} />
            </Field>
            <Field label="Buffer after" htmlFor="service-buffer-after" hint="Kept free after each booking.">
              <MinutesInput id="service-buffer-after" min={0} value={form.afterEventBuffer} onChange={(e) => set("afterEventBuffer", Number(e.target.value))} />
            </Field>
            <Field label="Seats per slot" htmlFor="service-seats" hint="Above 1, several people can book the same time with the same provider.">
              <Input id="service-seats" type="number" className="tabular-nums" min={1} max={100} value={form.seatsPerSlot} onChange={(e) => set("seatsPerSlot", Math.max(1, Number(e.target.value) || 1))} />
            </Field>
            <Field label="Max bookings per day" htmlFor="service-daily-cap" hint="Leave empty for no daily cap.">
              <Input id="service-daily-cap" type="number" className="tabular-nums" min={1} placeholder="Unlimited" value={form.maxBookingsPerDay ?? ""} onChange={(e) => set("maxBookingsPerDay", e.target.value ? Math.max(1, Number(e.target.value)) : null)} />
            </Field>
          </div>
          <div className="space-y-4 border-t pt-5">
            <ToggleRow
              id="service-confirmation"
              label="Require manual confirmation"
              hint="New bookings stay pending until they are accepted."
              checked={form.requiresConfirmation}
              onChange={(value) => set("requiresConfirmation", value)}
            />
            <ToggleRow
              id="service-no-guests"
              label="Do not allow additional guests"
              checked={form.disableGuests}
              onChange={(value) => set("disableGuests", value)}
            />
          </div>
        </FormSection>

        <FormSection
          title="Booking questions"
          description="Name and email are always included. Ask only for what the provider needs."
        >
          <div className="divide-y rounded-lg border">
            {fields.map((field, index) => {
              const update = (patch: Partial<BookingField>) =>
                setFields((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
              return (
                <div key={`${field.name}-${index}`} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                    <Input
                      aria-label="Question"
                      className="basis-full sm:flex-1 sm:basis-auto"
                      value={field.label}
                      onChange={(e) => update({ label: e.target.value })}
                    />
                    <Select value={field.type} disabled={field.system} onValueChange={(value) => update({ type: value as BookingField["type"] })}>
                      <SelectTrigger aria-label="Answer type" className="flex-1 sm:w-40 sm:flex-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Email is the built-in email question's type and is not offered for new questions. */}
                        {field.type === "email" ? <SelectItem value="email">Email</SelectItem> : null}
                        <SelectItem value="text">Short text</SelectItem>
                        <SelectItem value="textarea">Long text</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="checkbox">Checkbox</SelectItem>
                        <SelectItem value="select">Dropdown</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                      </SelectContent>
                    </Select>
                    {field.system ? (
                      // Keeps the type column lined up with removable questions.
                      <span aria-hidden className="hidden size-9 shrink-0 sm:block" />
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => setFields((items) => items.filter((_, i) => i !== index))} aria-label="Remove question">
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                  {field.type === "select" ? (
                    <Input
                      aria-label="Options"
                      value={(field.options ?? []).join(", ")}
                      placeholder="Options, comma separated, e.g. Small, Medium, Large"
                      onChange={(e) => update({ options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                    />
                  ) : null}
                  {field.system ? null : (
                    <Input
                      aria-label="Help text"
                      value={field.hint ?? ""}
                      placeholder="Optional help text"
                      onChange={(e) => update({ hint: e.target.value || undefined })}
                    />
                  )}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <label className="flex items-center gap-2 text-meta text-muted-foreground">
                      <Switch checked={field.required} onCheckedChange={(value) => update({ required: value })} /> Required
                    </label>
                    {/* A textarea beside another field looks broken, so the choice
                        is only offered where it makes sense. Short answers pairing
                        up is the difference between a form that fits on a phone
                        screen and one that scrolls. */}
                    {field.type === "textarea" ? null : (
                      <label className="flex items-center gap-2 text-meta text-muted-foreground">
                        <Switch
                          checked={field.width === "half"}
                          onCheckedChange={(value) => update({ width: value ? "half" : undefined })}
                        />{" "}
                        Half width
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div>
            <Button variant="outline" size="sm" onClick={() => setFields((items) => [...items, { name: `question_${Date.now()}`, label: "New question", type: "text", required: false }])}>
              <Plus /> Add question
            </Button>
          </div>
        </FormSection>
      </div>
    </div>
  );
}

/** Number input with a "min" unit inside the field, so labels stay short. */
function MinutesInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Input type="number" className={cn("pr-12 tabular-nums", className)} {...props} />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
        min
      </span>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <FieldHint>{hint}</FieldHint> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
