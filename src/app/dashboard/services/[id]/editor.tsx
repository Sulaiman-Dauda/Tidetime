"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BookingField, EventLocation, Service } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { updateServiceAction } from "../actions";

type Provider = { id: number; name: string | null; email: string };
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
        toast({ title: "Could not save service", description: result.error, variant: "destructive" });
        return;
      }
      setDraft(nextDraft);
      savedSnapshot.current = JSON.stringify({ form, locations, fields, providerIds, draft: nextDraft });
      toast({
        title: draft && !nextDraft ? "Service published" : nextDraft ? "Draft saved" : "Service saved",
      });
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link href="/dashboard/services"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold">{service.draft ? "New service" : form.title}</h1>
            {draft ? <Badge variant="secondary">Draft</Badge> : null}
            {dirty ? <Badge variant="outline" className="text-muted-foreground">Unsaved changes</Badge> : null}
          </div>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground">{publicUrl}</a>
        </div>
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
          <Check className="h-4 w-4" /> {pending ? "Saving…" : draft ? "Publish service" : "Save"}
        </Button>
      </div>

      <Card className="space-y-5 p-6">
        <SectionTitle title="Service details" description="The essentials customers see before booking." />
        <Field label="Name"><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Booking URL">
          <div className="flex items-center rounded-md border border-input pl-3 text-sm text-muted-foreground">
            <span>/book/{teamSlug}/</span>
            <input className="h-9 flex-1 bg-transparent px-1 text-foreground outline-none" value={form.slug} onChange={(e) => set("slug", slugify(e.target.value))} />
          </div>
        </Field>
        <Field label="Description"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Duration (minutes)"><Input type="number" min={5} value={form.length} onChange={(e) => set("length", Number(e.target.value))} /></Field>
          <Field label="Other durations" hint="Optional, comma separated">
            <Input value={form.durations.join(", ")} onChange={(e) => set("durations", [...new Set(e.target.value.split(",").map(Number).filter((n) => n >= 5 && n <= 1440 && n !== form.length))])} />
          </Field>
        </div>
        <Toggle label="Visible on company booking page" checked={!form.hidden} onChange={(value) => set("hidden", !value)} />
      </Card>

      <Card className="space-y-5 p-6">
        <SectionTitle title="Providers" description="Bookings are assigned to an available selected provider. With several providers, Tidetime uses least-busy round robin." />
        <div className="grid gap-2 sm:grid-cols-2">
          {providers.map((provider) => {
            const selected = providerIds.includes(provider.id);
            return (
              <label key={provider.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${selected ? "border-primary/40 bg-primary/5" : "border-border/60"}`}>
                <input type="checkbox" checked={selected} onChange={() => setProviderIds((ids) => selected ? ids.filter((id) => id !== provider.id) : [...ids, provider.id])} />
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{provider.name ?? provider.email}</span><span className="block truncate text-xs text-muted-foreground">{provider.email}</span></span>
              </label>
            );
          })}
        </div>
        {providerIds.length === 0 ? <p className="text-sm text-destructive">Assign at least one provider.</p> : null}
      </Card>

      <Card className="space-y-5 p-6">
        <SectionTitle title="Meeting location" description="Use built-in Jitsi, Google Meet, a physical address, phone, or your own link." />
        {locations.map((location, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-xl border border-border/60 p-3 sm:flex-row">
            <Select value={location.type} onValueChange={(value) => setLocations((items) => items.map((item, i) => i === index ? locationFor(value as EventLocation["type"]) : item))}>
              <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>{LOCATION_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
            {location.type === "in_person" ? <Input value={location.address} placeholder="Address" onChange={(e) => setLocations((items) => items.map((item, i) => i === index ? { type: "in_person", address: e.target.value } : item))} /> : null}
            {location.type === "phone" ? <Input value={location.phone ?? ""} placeholder="Phone number" onChange={(e) => setLocations((items) => items.map((item, i) => i === index ? { type: "phone", phone: e.target.value } : item))} /> : null}
            {location.type === "link" ? <Input value={location.link} type="url" placeholder="https://…" onChange={(e) => setLocations((items) => items.map((item, i) => i === index ? { type: "link", link: e.target.value } : item))} /> : null}
            <Button variant="ghost" size="icon" onClick={() => setLocations((items) => items.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {locations.length < 3 ? <Button variant="outline" size="sm" onClick={() => setLocations((items) => [...items, { type: "jitsi" }])}><Plus className="h-4 w-4" /> Add location</Button> : null}
      </Card>

      <Card className="space-y-5 p-6">
        <SectionTitle title="Availability rules" description="Provider working hours are configured on the Availability page." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Notice (minutes)"><Input type="number" min={0} value={form.minimumBookingNotice} onChange={(e) => set("minimumBookingNotice", Number(e.target.value))} /></Field>
          <Field label="Before buffer"><Input type="number" min={0} value={form.beforeEventBuffer} onChange={(e) => set("beforeEventBuffer", Number(e.target.value))} /></Field>
          <Field label="After buffer"><Input type="number" min={0} value={form.afterEventBuffer} onChange={(e) => set("afterEventBuffer", Number(e.target.value))} /></Field>
          <Field label="Slot interval"><Input type="number" min={5} placeholder={String(form.length)} value={form.slotInterval ?? ""} onChange={(e) => set("slotInterval", e.target.value ? Number(e.target.value) : null)} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Seats per slot" hint="More than 1 turns this into a group event — several people can book the same time with the same provider.">
            <Input type="number" min={1} max={100} value={form.seatsPerSlot} onChange={(e) => set("seatsPerSlot", Math.max(1, Number(e.target.value) || 1))} />
          </Field>
          <Field label="Max bookings per day" hint="Leave empty for no daily cap.">
            <Input type="number" min={1} placeholder="Unlimited" value={form.maxBookingsPerDay ?? ""} onChange={(e) => set("maxBookingsPerDay", e.target.value ? Math.max(1, Number(e.target.value)) : null)} />
          </Field>
        </div>
        <Toggle label="Require manual confirmation" checked={form.requiresConfirmation} onChange={(value) => set("requiresConfirmation", value)} />
        <Toggle label="Do not allow additional guests" checked={form.disableGuests} onChange={(value) => set("disableGuests", value)} />
      </Card>

      <Card className="space-y-5 p-6">
        <SectionTitle title="Booking questions" description="Name and email are always included. Add only information the provider needs." />
        {fields.map((field, index) => {
          const update = (patch: Partial<BookingField>) =>
            setFields((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
          return (
            <div key={`${field.name}-${index}`} className="space-y-2 rounded-xl border border-border/60 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_170px_auto]">
                <Input value={field.label} onChange={(e) => update({ label: e.target.value })} />
                <Select value={field.type} disabled={field.system} onValueChange={(value) => update({ type: value as BookingField["type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Short text</SelectItem>
                    <SelectItem value="textarea">Long text</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="checkbox">Checkbox</SelectItem>
                    <SelectItem value="select">Dropdown</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                  </SelectContent>
                </Select>
                {field.system ? null : <Button variant="ghost" size="icon" onClick={() => setFields((items) => items.filter((_, i) => i !== index))} aria-label="Remove question"><Trash2 className="h-4 w-4" /></Button>}
              </div>
              {field.type === "select" ? (
                <Input
                  value={(field.options ?? []).join(", ")}
                  placeholder="Options, comma separated — e.g. Small, Medium, Large"
                  onChange={(e) => update({ options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                />
              ) : null}
              {field.system ? null : (
                <Input
                  value={field.hint ?? ""}
                  placeholder="Help text shown under the question (optional)"
                  className="text-xs"
                  onChange={(e) => update({ hint: e.target.value || undefined })}
                />
              )}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={field.required} onCheckedChange={(value) => update({ required: value })} /> Required
                </label>
                {/* A textarea beside another field looks broken, so the choice
                    is only offered where it makes sense. Short answers pairing
                    up is the difference between a form that fits on a phone
                    screen and one that scrolls. */}
                {field.type === "textarea" ? null : (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
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
        <Button variant="outline" size="sm" onClick={() => setFields((items) => [...items, { name: `question_${Date.now()}`, label: "New question", type: "text", required: false }])}><Plus className="h-4 w-4" /> Add question</Button>
      </Card>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-4 text-sm"><span>{label}</span><Switch checked={checked} onCheckedChange={onChange} /></label>;
}
