"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDuration, initials, WEEKDAY_SHORT } from "@/lib/format";
import { locationLabel } from "@/lib/locations";
import { guessTimeZone, listTimeZones } from "@/lib/timezones";
import {
  visibleFields,
  validateResponses,
  pruneHiddenResponses,
  type FieldValues,
} from "@/lib/booking-fields";
import type { BookingField, EventLocation } from "@/db/schema";
import { describeRecurrence } from "@/lib/recurrence";
import { bookAction, type BookActionState } from "../../actions";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Globe,
  Loader2,
  Video,
  Check,
  ChevronLeft,
  ChevronRight,
  Repeat,
} from "lucide-react";

interface EventTypeView {
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
  price: number;
  currency: string;
  recurringEvent?: { freq: "weekly" | "monthly"; interval: number; count: number } | null;
}

interface HostView {
  name: string | null;
  username: string;
  avatarUrl: string | null;
}

interface Props {
  username: string;
  slug: string;
  rescheduleUid?: string;
  bookingLinkToken?: string;
  teamSlug?: string;
  embed?: boolean;
  eventType: EventTypeView;
  host: HostView;
}

interface SlotsResponse {
  byDay: Record<string, { time: string; seatsRemaining?: number }[]>;
}

/** Local YYYY-MM-DD for a date in a given timezone. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthMatrix(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export function BookingFlow({ username, slug, rescheduleUid, bookingLinkToken, teamSlug, embed: _embed, eventType, host }: Props) {
  const router = useRouter();
  const hostName = host.name ?? host.username;

  const [timeZone, setTimeZone] = useState(eventType.scheduleTimeZone);
  const [duration, setDuration] = useState(eventType.length);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [byDay, setByDay] = useState<SlotsResponse["byDay"]>({});
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"pick" | "form">("pick");

  useEffect(() => setTimeZone(guessTimeZone()), []);

  const durations = useMemo(
    () => (eventType.durations.length > 0 ? eventType.durations : [eventType.length]),
    [eventType.durations, eventType.length],
  );

  // Fetch slots for the visible month.
  useEffect(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const start = dayKey(new Date(year, month, 1));
    const end = dayKey(new Date(year, month + 1, 0));
    const controller = new AbortController();
    setLoading(true);
    const qs = teamSlug
      ? new URLSearchParams({ team: teamSlug, slug, start, end, duration: String(duration), tz: timeZone })
      : new URLSearchParams({ username, slug, start, end, duration: String(duration), tz: timeZone });
    const endpoint = teamSlug ? "/api/slots/team" : "/api/slots";
    fetch(`${endpoint}?${qs}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: SlotsResponse) => setByDay(data.byDay ?? {}))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [username, slug, teamSlug, duration, timeZone, viewDate]);

  const rows = monthMatrix(viewDate.getFullYear(), viewDate.getMonth());
  const todayKeyStr = dayKey(new Date());
  const daySlots = selectedDay ? byDay[selectedDay] ?? [] : [];

  const loc = eventType.locations[0];
  const tzList = useMemo(() => listTimeZones(), []);

  function goMonth(delta: number) {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
    setSelectedDay(null);
    setSelectedSlot(null);
  }

  function pickSlot(time: string) {
    setSelectedSlot(time);
    setStep("form");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="grid md:grid-cols-[320px_1fr]">
          {/* Left rail: event details */}
          <aside className="border-b p-6 md:border-b-0 md:border-r">
            {rescheduleUid ? (
              <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                Rescheduling your existing booking
              </div>
            ) : null}
            <Avatar className="h-11 w-11 ring-1 ring-border">
              {host.avatarUrl ? <AvatarImage src={host.avatarUrl} alt={hostName} /> : null}
              <AvatarFallback>{initials(hostName)}</AvatarFallback>
            </Avatar>
            <p className="mt-4 text-sm text-muted-foreground">{hostName}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">{eventType.title}</h1>
            {eventType.description ? (
              <p className="mt-3 text-sm text-muted-foreground">{eventType.description}</p>
            ) : null}

            <ul className="mt-6 space-y-2.5 text-sm">
              <li className="flex items-center gap-2.5 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                {formatDuration(duration)}
              </li>
              {loc ? (
                <li className="flex items-center gap-2.5 text-muted-foreground">
                  <Video className="h-4 w-4 shrink-0" />
                  {locationLabel(loc)}
                </li>
              ) : null}
              {eventType.price > 0 ? (
                <li className="flex items-center gap-2.5 font-medium">
                  {(eventType.price / 100).toLocaleString(undefined, {
                    style: "currency",
                    currency: eventType.currency.toUpperCase(),
                  })}
                </li>
              ) : null}
              {eventType.recurringEvent && eventType.recurringEvent.count > 1 ? (
                <li className="flex items-center gap-2.5 text-muted-foreground">
                  <Repeat className="h-4 w-4 shrink-0" />
                  {describeRecurrence(eventType.recurringEvent)}
                </li>
              ) : null}
              <li className="flex items-center gap-2.5 text-muted-foreground">
                <Globe className="h-4 w-4 shrink-0" />
                <Select value={timeZone} onValueChange={setTimeZone}>
                  <SelectTrigger className="h-7 border-0 px-0 text-sm shadow-none focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tzList.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            </ul>

            {durations.length > 1 && step === "pick" ? (
              <div className="mt-6">
                <Label className="text-xs text-muted-foreground">Duration</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {durations.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        d === duration ? "border-brand bg-brand text-brand-foreground" : "hover:bg-muted"
                      }`}
                    >
                      {formatDuration(d)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>

          {/* Right: calendar + slots OR form */}
          <section className="p-6">
            {step === "form" && selectedSlot ? (
              <BookingForm
                username={username}
                slug={slug}
                rescheduleUid={rescheduleUid}
                bookingLinkToken={bookingLinkToken}
                teamSlug={teamSlug}
                eventType={eventType}
                duration={duration}
                timeZone={timeZone}
                slot={selectedSlot}
                onBack={() => setStep("pick")}
                onBooked={(uid) => router.push(`/booking/${uid}` as Route)}
              />
            ) : (
              <div className="grid gap-6 sm:grid-cols-[1fr_220px]">
                {/* Calendar */}
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">
                      {viewDate.toLocaleString(undefined, { month: "long", year: "numeric" })}
                    </h2>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goMonth(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goMonth(1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                    {WEEKDAY_SHORT.map((d) => (
                      <div key={d} className="py-1.5 font-medium">
                        {d[0]}
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1">
                    {rows.flat().map((date, i) => {
                      if (!date) return <div key={i} />;
                      const key = dayKey(date);
                      const has = (byDay[key]?.length ?? 0) > 0;
                      const isPast = key < todayKeyStr;
                      const isSelected = key === selectedDay;
                      return (
                        <button
                          key={i}
                          disabled={!has || isPast}
                          onClick={() => {
                            setSelectedDay(key);
                            setSelectedSlot(null);
                          }}
                          className={`aspect-square rounded-lg text-sm font-medium transition-colors ${
                            isSelected
                              ? "bg-brand text-brand-foreground shadow-brand"
                              : has && !isPast
                                ? "bg-muted/60 text-foreground hover:bg-muted"
                                : "text-muted-foreground/40"
                          }`}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time slots */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Calendar className="h-4 w-4" />
                    {selectedDay
                      ? new Date(`${selectedDay}T00:00:00`).toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : "Pick a day"}
                  </div>
                  <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                    {loading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : !selectedDay ? (
                      <p className="py-8 text-center text-xs text-muted-foreground">
                        Select a date to see available times.
                      </p>
                    ) : daySlots.length === 0 ? (
                      <p className="py-8 text-center text-xs text-muted-foreground">No times available.</p>
                    ) : (
                      daySlots.map((s) => (
                        <button
                          key={s.time}
                          onClick={() => pickSlot(s.time)}
                          className="w-full rounded-lg border py-2.5 text-sm font-medium transition-colors hover:border-brand hover:bg-brand/5 hover:text-brand"
                        >
                          {new Date(s.time).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone,
                          })}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function BookingForm({
  username,
  slug,
  rescheduleUid,
  bookingLinkToken,
  teamSlug,
  eventType,
  duration,
  timeZone,
  slot,
  onBack,
  onBooked,
}: {
  username: string;
  slug: string;
  rescheduleUid?: string;
  bookingLinkToken?: string;
  teamSlug?: string;
  eventType: EventTypeView;
  duration: number;
  timeZone: string;
  slot: string;
  onBack: () => void;
  onBooked: (uid: string) => void;
}) {
  const [state, formAction, pending] = useActionState<BookActionState, FormData>(bookAction, null);
  const [values, setValues] = useState<FieldValues>({});
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const renderedAtRef = useRef(Date.now());

  useEffect(() => {
    if (state?.uid) onBooked(state.uid);
  }, [state, onBooked]);

  const shownFields = visibleFields(eventType.bookingFields, values).filter(
    (f) => f.name !== "name" && f.name !== "email",
  );

  function submit(formData: FormData) {
    const errors = validateResponses(eventType.bookingFields, values);
    if (Object.keys(errors).length) {
      setClientErrors(errors);
      return;
    }
    setClientErrors({});
    const responses = pruneHiddenResponses(eventType.bookingFields, values);
    const payload = {
      username,
      slug,
      teamSlug,
      start: slot,
      duration,
      timeZone,
      name: typeof values.name === "string" ? values.name : "",
      email: typeof values.email === "string" ? values.email : "",
      responses,
      rescheduleUid,
      bookingLinkToken,
      hp: typeof formData.get("company") === "string" ? (formData.get("company") as string) : "",
      ts: renderedAtRef.current,
    };
    formData.set("payload", JSON.stringify(payload));
    formAction(formData);
  }

  const set = (name: string) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [name]: e.target.value }));

  const setValue = (name: string, value: string | boolean | string[]) =>
    setValues((v) => ({ ...v, [name]: value }));

  const toggleMulti = (name: string, option: string) =>
    setValues((v) => {
      const current = Array.isArray(v[name]) ? (v[name] as string[]) : [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...v, [name]: next };
    });

  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mb-6 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
        <span className="font-medium">
          {new Date(slot).toLocaleString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZone,
          })}
        </span>
        <span className="ml-2 text-muted-foreground">· {formatDuration(duration)}</span>
      </div>

      <form action={submit} className="space-y-4">
        {/* Honeypot — hidden from real users; bots that fill it are rejected. */}
        <div aria-hidden className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden" >
          <label htmlFor="company">Company</label>
          <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name *</Label>
          <Input id="name" required value={typeof values.name === "string" ? values.name : ""} onChange={set("name")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" type="email" required value={typeof values.email === "string" ? values.email : ""} onChange={set("email")} />
        </div>

        {shownFields.map((f) => {
          const raw = values[f.name];
          const strValue = typeof raw === "string" ? raw : "";
          const arrValue = Array.isArray(raw) ? raw : [];
          return (
            <div key={f.name} className="space-y-1.5">
              {f.type !== "checkbox" ? (
                <Label htmlFor={f.name}>
                  {f.label}
                  {f.required ? " *" : ""}
                </Label>
              ) : null}
              {f.type === "textarea" ? (
                <Textarea id={f.name} placeholder={f.placeholder} value={strValue} onChange={set(f.name)} />
              ) : f.type === "select" ? (
                <Select value={strValue} onValueChange={(v) => setValue(f.name, v)}>
                  <SelectTrigger id={f.name}>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(f.options ?? []).map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f.type === "radio" ? (
                <div className="space-y-2">
                  {(f.options ?? []).map((o) => (
                    <label key={o} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={f.name}
                        value={o}
                        checked={strValue === o}
                        onChange={() => setValue(f.name, o)}
                        className="h-4 w-4"
                      />
                      {o}
                    </label>
                  ))}
                </div>
              ) : f.type === "multiselect" ? (
                <div className="space-y-2">
                  {(f.options ?? []).map((o) => (
                    <label key={o} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        value={o}
                        checked={arrValue.includes(o)}
                        onChange={() => toggleMulti(f.name, o)}
                        className="h-4 w-4"
                      />
                      {o}
                    </label>
                  ))}
                </div>
              ) : f.type === "checkbox" ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    id={f.name}
                    type="checkbox"
                    checked={raw === true}
                    onChange={(e) => setValue(f.name, e.target.checked)}
                    className="h-4 w-4"
                  />
                  {f.label}
                  {f.required ? " *" : ""}
                </label>
              ) : f.type === "file" ? (
                <Input
                  id={f.name}
                  type="file"
                  accept={f.accept}
                  onChange={(e) => setValue(f.name, e.target.files?.[0]?.name ?? "")}
                />
              ) : (
                <Input
                  id={f.name}
                  type={f.type === "number" ? "number" : f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"}
                  placeholder={f.placeholder}
                  value={strValue}
                  onChange={set(f.name)}
                />
              )}
              {clientErrors[f.name] ? (
                <p className="text-xs text-destructive">{clientErrors[f.name]}</p>
              ) : null}
            </div>
          );
        })}

        {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Check className="h-4 w-4" />
              {eventType.requiresConfirmation ? "Request booking" : "Confirm booking"}
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
