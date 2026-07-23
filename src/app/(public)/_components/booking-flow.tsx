"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, Clock, Loader2, MapPin, User } from "lucide-react";
import type { BookingField, EventLocation } from "@/db/schema";
import { bookAction, type BookActionState } from "@/app/(public)/actions";
import { AltchaWidget } from "@/components/altcha-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { locationLabel } from "@/lib/locations";

type ServiceView = {
  id: number;
  title: string;
  description: string | null;
  length: number;
  durations: number[];
  locations: EventLocation[];
  bookingFields: BookingField[];
  requiresConfirmation: boolean;
  disableGuests: boolean;
  scheduleTimeZone: string;
};

type Host = { id: number; name: string | null; username: string; avatarUrl?: string | null };
type Props = {
  slug: string;
  teamSlug: string;
  rescheduleUid?: string;
  service: ServiceView;
  host: { name: string | null; username: string; avatarUrl?: string | null };
  spamProtection?: boolean;
  botChallenge?: string;
  teamHosts?: Host[];
};

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

export function BookingFlow({ slug, teamSlug, rescheduleUid, service, host, spamProtection, botChallenge, teamHosts = [] }: Props) {
  const router = useRouter();
  const [duration, setDuration] = useState(service.length);
  const [timeZone, setTimeZone] = useState(service.scheduleTimeZone);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [slots, setSlots] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    try { setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || service.scheduleTimeZone); } catch { /* use service timezone */ }
  }, [service.scheduleTimeZone]);

  useEffect(() => {
    const start = dayKey(new Date());
    const end = dayKey(addDays(new Date(), 30));
    const query = new URLSearchParams({ team: teamSlug, slug, start, end, duration: String(duration), tz: timeZone });
    if (providerId) query.set("host", String(providerId));
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/slots/team?${query}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("slots")))
      .then((data) => setSlots(data.byDay ?? {}))
      .catch(() => { if (!controller.signal.aborted) setSlots({}); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [teamSlug, slug, duration, timeZone, providerId]);

  const days = useMemo(() => Object.entries(slots).filter(([, values]) => values.length > 0).slice(0, 14), [slots]);
  const durations = [...new Set([service.length, ...service.durations])].sort((a, b) => a - b);

  if (showForm && selectedSlot) {
    return (
      <BookingForm
        slug={slug}
        teamSlug={teamSlug}
        service={service}
        duration={duration}
        timeZone={timeZone}
        slot={selectedSlot}
        preferredHostId={providerId ?? undefined}
        rescheduleUid={rescheduleUid}
        spamProtection={spamProtection}
        botChallenge={botChallenge}
        onBack={() => setShowForm(false)}
        onBooked={(uid) => router.push(`/booking/${uid}`)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <div className="grid overflow-hidden rounded-2xl border bg-card shadow-sm md:grid-cols-[280px_1fr]">
        <aside className="space-y-5 border-b p-6 md:border-b-0 md:border-r">
          <p className="text-sm text-muted-foreground">{host.name ?? host.username}</p>
          <h1 className="text-xl font-semibold">{service.title}</h1>
          {service.description ? <p className="text-sm text-muted-foreground">{service.description}</p> : null}
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> {duration} minutes</p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {locationLabel(service.locations[0])}</p>
          {service.requiresConfirmation ? <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700">The company confirms this booking after submission.</p> : null}
        </aside>
        <section className="space-y-5 p-6">
          <div className="flex flex-wrap gap-3">
            {durations.length > 1 ? (
              <Select value={String(duration)} onValueChange={(value) => setDuration(Number(value))}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{durations.map((value) => <SelectItem key={value} value={String(value)}>{value} minutes</SelectItem>)}</SelectContent>
              </Select>
            ) : null}
            {teamHosts.length > 1 ? (
              <Select value={providerId ? String(providerId) : "any"} onValueChange={(value) => setProviderId(value === "any" ? null : Number(value))}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="any">Any available provider</SelectItem>{teamHosts.map((member) => <SelectItem key={member.id} value={String(member.id)}>{member.name ?? member.username}</SelectItem>)}</SelectContent>
              </Select>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4" /> Times shown in {timeZone}</div>
          {loading ? <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading availability…</div> : null}
          {!loading && days.length === 0 ? <p className="py-12 text-sm text-muted-foreground">No available times in the next 30 days.</p> : null}
          <div className="space-y-5">
            {days.map(([day, values]) => (
              <div key={day}>
                <h2 className="mb-2 text-sm font-medium">{new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h2>
                <div className="flex flex-wrap gap-2">
                  {values.map((value) => <Button key={value} data-testid="slot" variant="outline" size="sm" onClick={() => { setSelectedSlot(value); setShowForm(true); }}>{new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Button>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function BookingForm({ slug, teamSlug, service, duration, timeZone, slot, preferredHostId, rescheduleUid, spamProtection, botChallenge, onBack, onBooked }: {
  slug: string; teamSlug: string; service: ServiceView; duration: number; timeZone: string; slot: string;
  preferredHostId?: number; rescheduleUid?: string; spamProtection?: boolean; botChallenge?: string; onBack: () => void; onBooked: (uid: string) => void;
}) {
  const [state, formAction, pending] = useActionState<BookActionState, FormData>(bookAction, null);
  const [values, setValues] = useState<Record<string, string | boolean>>({ name: "", email: "" });
  const [altcha, setAltcha] = useState<string | null>(null);
  const renderedAt = useRef(Date.now());

  useEffect(() => { if (state?.uid) onBooked(state.uid); }, [state, onBooked]);
  const customFields = service.bookingFields.filter((field) => !["name", "email"].includes(field.name) && !field.hidden);

  function submit(formData: FormData) {
    const payload = {
      slug, teamSlug, start: slot, duration, timeZone,
      name: String(values.name ?? ""), email: String(values.email ?? ""), responses: values,
      preferredHostId, rescheduleUid, hp: formData.get("company") ?? "", ts: renderedAt.current,
      bc: botChallenge, altcha: altcha ?? undefined,
    };
    formData.set("payload", JSON.stringify(payload));
    formAction(formData);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
      <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="h-4 w-4" /> Choose another time</Button>
      <form action={submit} className="mt-4 space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
        <div><h1 className="text-lg font-semibold">Your details</h1><p className="mt-1 text-sm text-muted-foreground">{new Date(slot).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}</p></div>
        <div className="hidden"><Input name="company" tabIndex={-1} autoComplete="off" /></div>
        <Field label="Name"><Input id="name" required value={String(values.name)} onChange={(e) => setValues((current) => ({ ...current, name: e.target.value }))} /></Field>
        <Field label="Email"><Input id="email" required type="email" value={String(values.email)} onChange={(e) => setValues((current) => ({ ...current, email: e.target.value }))} /></Field>
        {customFields.map((field) => (
          <Field key={field.name} label={field.label}>
            {field.type === "textarea" ? <Textarea required={field.required} value={String(values[field.name] ?? "")} onChange={(e) => setValues((current) => ({ ...current, [field.name]: e.target.value }))} /> : field.type === "checkbox" ? <input type="checkbox" checked={Boolean(values[field.name])} onChange={(e) => setValues((current) => ({ ...current, [field.name]: e.target.checked }))} /> : <Input required={field.required} type={field.type === "email" || field.type === "phone" || field.type === "number" ? field.type : "text"} value={String(values[field.name] ?? "")} onChange={(e) => setValues((current) => ({ ...current, [field.name]: e.target.value }))} />}
          </Field>
        ))}
        {spamProtection ? <AltchaWidget onChange={setAltcha} /> : null}
        {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <Button type="submit" data-testid="confirm-booking" className="w-full" disabled={pending || (spamProtection && !altcha)}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />} {pending ? "Booking…" : "Confirm booking"}</Button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
