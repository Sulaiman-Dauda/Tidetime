"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDuration, initials, WEEKDAY_SHORT } from "@/lib/format";
import { isUnsupportedLocationType, locationLabel } from "@/lib/locations";
import { guessTimeZone, listTimeZones } from "@/lib/timezones";
import {
  visibleFields,
  validateResponses,
  pruneHiddenResponses,
  type FieldValues,
} from "@/lib/booking-fields";
import type { BookingField, EventLocation } from "@/db/schema";
import { describeRecurrence } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import { bookAction, type BookActionState } from "../../actions";
import { StripeProvider } from "@/components/stripe-provider";
import { StripeCheckout } from "@/components/stripe-checkout";
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
  AlertTriangle,
  RefreshCw,
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
  requiresPayment: boolean;
  disableGuests: boolean;
  scheduleTimeZone: string;
  price: number;
  currency: string;
  successRedirectUrl?: string | null;
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
  stripePublishableKey?: string | null;
  paymentReturnBookingUid?: string;
  paymentReturnIntentId?: string;
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

function validateContactDetails(values: FieldValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = typeof values.name === "string" ? values.name.trim() : "";
  const email = typeof values.email === "string" ? values.email.trim() : "";

  if (!name) errors.name = "Name is required";
  if (!email) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email";

  return errors;
}

function parseGuestEmails(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function validateGuestEmails(guests: string[], primaryEmail: string): string | null {
  for (const guest of guests) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest)) return "Enter valid guest email addresses";
    if (primaryEmail && guest === primaryEmail.toLowerCase()) return "Guest email addresses must be different from your own";
  }
  return null;
}

export function BookingFlow({
  username,
  slug,
  rescheduleUid,
  bookingLinkToken,
  teamSlug,
  embed: _embed,
  stripePublishableKey,
  paymentReturnBookingUid,
  paymentReturnIntentId,
  eventType,
  host,
}: Props) {
  const router = useRouter();
  const hostName = host.name ?? host.username;

  const [timeZone, setTimeZone] = useState(eventType.scheduleTimeZone);
  const [duration, setDuration] = useState(eventType.length);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [byDay, setByDay] = useState<SlotsResponse["byDay"]>({});
  const [loading, setLoading] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [step, setStep] = useState<"pick" | "form">("pick");
  const [finalizingPayment, setFinalizingPayment] = useState(
    Boolean(paymentReturnBookingUid && paymentReturnIntentId),
  );
  const [paymentReturnError, setPaymentReturnError] = useState<string | null>(null);
  const slotsCacheRef = useRef<Record<string, SlotsResponse["byDay"]>>({});

  useEffect(() => setTimeZone(guessTimeZone()), []);

  const durations = useMemo(
    () => (eventType.durations.length > 0 ? eventType.durations : [eventType.length]),
    [eventType.durations, eventType.length],
  );

  const finishBooking = useCallback((uid: string) => {
    if (eventType.successRedirectUrl && typeof window !== "undefined") {
      try {
        const url = new URL(eventType.successRedirectUrl);
        url.searchParams.set("booking", uid);
        url.searchParams.set("manage", `${window.location.origin}/booking/${uid}`);
        window.location.assign(url.toString());
        return;
      } catch {
        // fall back to the built-in manage page
      }
    }
    router.push(`/booking/${uid}` as Route);
  }, [eventType.successRedirectUrl, router]);

  useEffect(() => {
    if (!paymentReturnBookingUid || !paymentReturnIntentId) return;

    let active = true;
    setFinalizingPayment(true);
    fetch("/api/stripe/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingUid: paymentReturnBookingUid,
        paymentIntentId: paymentReturnIntentId,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (res.ok && data.ok) {
          finishBooking(paymentReturnBookingUid);
          return;
        }
        setPaymentReturnError(data.error ?? "We couldn't confirm the payment yet.");
      })
      .catch(() => {
        if (!active) return;
        setPaymentReturnError("We couldn't confirm the payment yet. Please refresh or check your email.");
      })
      .finally(() => {
        if (active) setFinalizingPayment(false);
      });

    return () => {
      active = false;
    };
  }, [finishBooking, paymentReturnBookingUid, paymentReturnIntentId]);

  // Fetch slots for the visible month.
  useEffect(() => {
    if (finalizingPayment) return;

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const start = dayKey(new Date(year, month, 1));
    const end = dayKey(new Date(year, month + 1, 0));
    const controller = new AbortController();
    const cacheKey = [
      teamSlug ? `team:${teamSlug}` : `user:${username}`,
      slug,
      String(duration),
      timeZone,
      start,
      end,
    ].join("|");

    const cached = slotsCacheRef.current[cacheKey];
    if (cached) {
      setByDay(cached);
      setSlotError(null);
      setLoading(false);
      return () => controller.abort();
    }

    setLoading(true);
    setSlotError(null);
    const qs = teamSlug
      ? new URLSearchParams({ team: teamSlug, slug, start, end, duration: String(duration), tz: timeZone })
      : new URLSearchParams({ username, slug, start, end, duration: String(duration), tz: timeZone });
    const endpoint = teamSlug ? "/api/slots/team" : "/api/slots";
    fetch(`${endpoint}?${qs}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load slots");
        return (await r.json()) as SlotsResponse;
      })
      .then((data) => {
        const nextByDay = data.byDay ?? {};
        slotsCacheRef.current[cacheKey] = nextByDay;
        setByDay(nextByDay);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setByDay({});
        setSlotError("We couldn’t load availability for this month.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [username, slug, teamSlug, duration, timeZone, viewDate, reloadNonce, finalizingPayment]);

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

  if (finalizingPayment) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <h1 className="mt-4 text-lg font-semibold tracking-tight">Finalising payment…</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;re confirming your payment with Stripe and updating the booking now.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      {paymentReturnError ? (
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {paymentReturnError}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="grid md:grid-cols-[320px_1fr]">
          {/* Left rail: event details */}
          <aside className="border-b p-6 md:border-b-0 md:border-r">
            {rescheduleUid ? (
              <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                Rescheduling your existing booking
              </div>
            ) : null}
            <Avatar className="h-11 w-11 ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
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
              {eventType.requiresPayment && eventType.price > 0 ? (
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

            {loc && isUnsupportedLocationType(loc.type) ? (
              <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                Video links are arranged manually for this service. The host will share the final join details separately.
              </p>
            ) : null}

            {durations.length > 1 && step === "pick" ? (
              <div className="mt-6">
                <Label className="text-xs text-muted-foreground">Duration</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {durations.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                        d === duration ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border/60 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
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
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  step === "pick" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                1. Choose a time
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  step === "form" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                2. Your details
              </span>
            </div>

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
                stripePublishableKey={stripePublishableKey}
                onBack={() => setStep("pick")}
                onBooked={finishBooking}
              />
            ) : (
              <>
                <div className="mb-5">
                  <h2 className="text-lg font-semibold tracking-tight">Choose a date and time</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Select a date, then pick one of the available times.
                  </p>
                </div>
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
                          className={`aspect-square rounded-xl text-sm font-medium transition-all duration-150 ${
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-brand scale-[1.05]"
                              : has && !isPast
                                ? "bg-muted/60 text-foreground hover:bg-primary/15 hover:text-primary"
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
                      <div className="space-y-2 py-1">
                        {Array.from({ length: 6 }).map((_, idx) => (
                          <Skeleton key={idx} className="h-11 w-full rounded-xl" />
                        ))}
                      </div>
                    ) : slotError ? (
                      <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-4 text-sm">
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                          <div>
                            <p className="font-medium text-foreground">Couldn’t load times</p>
                            <p className="mt-1 text-xs">{slotError}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => setReloadNonce((n) => n + 1)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Try again
                        </Button>
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
                          className="w-full rounded-xl border border-border/60 py-3 text-sm font-medium transition-all duration-150 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-sm active:scale-[0.98]"
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
              </>
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
  stripePublishableKey,
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
  stripePublishableKey?: string | null;
  onBack: () => void;
  onBooked: (uid: string) => void;
}) {
  const [state, formAction, pending] = useActionState<BookActionState, FormData>(bookAction, null);
  const [values, setValues] = useState<FieldValues>({});
  const [guestEmails, setGuestEmails] = useState("");
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"form" | "pay">("form");
  const [bookingUid, setBookingUid] = useState<string | null>(null);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const renderedAtRef = useRef(Date.now());

  useEffect(() => {
    if (!state) return;
    if (state.requiresPayment && state.paymentClientSecret && state.uid) {
      setBookingUid(state.uid);
      setPaymentClientSecret(state.paymentClientSecret);
      setStep("pay");
    } else if (state.uid) {
      onBooked(state.uid);
    }
  }, [state, onBooked]);

  const shownFields = visibleFields(eventType.bookingFields, values).filter(
    (f) => f.name !== "name" && f.name !== "email",
  );

  function submit(formData: FormData) {
    const primaryEmail = typeof values.email === "string" ? values.email.trim() : "";
    const guests = eventType.disableGuests ? [] : parseGuestEmails(guestEmails);
    const guestError = eventType.disableGuests ? null : validateGuestEmails(guests, primaryEmail);

    const errors = {
      ...validateContactDetails(values),
      ...validateResponses(eventType.bookingFields, values),
      ...(guestError ? { guests: guestError } : {}),
    };
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
      email: primaryEmail,
      guests: guests.length > 0 ? guests : undefined,
      responses,
      rescheduleUid,
      bookingLinkToken,
      hp: typeof formData.get("company") === "string" ? (formData.get("company") as string) : "",
      ts: renderedAtRef.current,
    };
    formData.set("payload", JSON.stringify(payload));
    formAction(formData);
  }

  function clearFieldError(name: string) {
    setClientErrors((errors) => {
      if (!errors[name]) return errors;
      const next = { ...errors };
      delete next[name];
      return next;
    });
  }

  function onGuestInput(value: string) {
    clearFieldError("guests");
    setGuestEmails(value);
  }

  const set = (name: string) => (e: { target: { value: string } }) => {
    clearFieldError(name);
    setValues((v) => ({ ...v, [name]: e.target.value }));
  };

  const setValue = (name: string, value: string | boolean | string[]) => {
    clearFieldError(name);
    setValues((v) => ({ ...v, [name]: value }));
  };

  const toggleMulti = (name: string, option: string) => {
    clearFieldError(name);
    setValues((v) => {
      const current = Array.isArray(v[name]) ? (v[name] as string[]) : [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...v, [name]: next };
    });
  };

  if (step === "pay" && paymentClientSecret && bookingUid) {
    return (
      <div>
        <button onClick={() => setStep("form")} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to details
        </button>
        <div className="mb-6 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
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
        {!stripePublishableKey ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Stripe checkout is not configured correctly yet. Ask the administrator to add the publishable key in Settings → Stripe.
          </div>
        ) : (
          <StripeProvider clientSecret={paymentClientSecret} publishableKey={stripePublishableKey}>
            <StripeCheckout
              amount={eventType.price}
              currency={eventType.currency}
              bookingUid={bookingUid}
              onSuccess={() => onBooked(bookingUid)}
              onError={(msg) => setClientErrors({ payment: msg })}
              onBack={() => setStep("form")}
            />
          </StripeProvider>
        )}
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mb-6 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
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

      <div className="mb-6">
        <h2 className="text-lg font-semibold tracking-tight">Your details</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We’ll use this to send your confirmation and calendar invite.
        </p>
      </div>

      <form action={submit} className="space-y-4">
        {/* Honeypot — hidden from real users; bots that fill it are rejected. */}
        <div aria-hidden className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden" >
          <label htmlFor="company">Company</label>
          <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name *</Label>
          <Input
            id="name"
            required
            aria-invalid={Boolean(clientErrors.name)}
            value={typeof values.name === "string" ? values.name : ""}
            onChange={set("name")}
          />
          {clientErrors.name ? <p className="text-xs text-destructive">{clientErrors.name}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            required
            aria-invalid={Boolean(clientErrors.email)}
            value={typeof values.email === "string" ? values.email : ""}
            onChange={set("email")}
          />
          {clientErrors.email ? <p className="text-xs text-destructive">{clientErrors.email}</p> : null}
        </div>

        {!eventType.disableGuests ? (
          <div className="space-y-1.5">
            <Label htmlFor="guests">Invite guests (optional)</Label>
            <Textarea
              id="guests"
              rows={3}
              placeholder="guest1@example.com, guest2@example.com"
              value={guestEmails}
              onChange={(e) => onGuestInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter one email per line or separate multiple guests with commas.
            </p>
            {clientErrors.guests ? <p className="text-xs text-destructive">{clientErrors.guests}</p> : null}
          </div>
        ) : null}

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
                  {(f.options ?? []).map((o) => {
                    const checked = strValue === o;
                    return (
                      <label
                        key={o}
                        className={cn(
                          "flex cursor-pointer items-center justify-between rounded-xl border px-3 py-3 text-sm transition-colors",
                          checked
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border/60 hover:border-primary/30 hover:bg-secondary/60",
                        )}
                      >
                        <input
                          type="radio"
                          name={f.name}
                          value={o}
                          checked={checked}
                          onChange={() => setValue(f.name, o)}
                          className="sr-only"
                        />
                        <span>{o}</span>
                        <span
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-full border",
                            checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
                          )}
                          aria-hidden
                        >
                          {checked ? <Check className="h-3 w-3" /> : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : f.type === "multiselect" ? (
                <div className="flex flex-wrap gap-2">
                  {(f.options ?? []).map((o) => {
                    const checked = arrValue.includes(o);
                    return (
                      <label
                        key={o}
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                          checked
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border/60 hover:border-primary/30 hover:bg-secondary/60",
                        )}
                      >
                        <input
                          type="checkbox"
                          value={o}
                          checked={checked}
                          onChange={() => toggleMulti(f.name, o)}
                          className="sr-only"
                        />
                        <span>{o}</span>
                        {checked ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                      </label>
                    );
                  })}
                </div>
              ) : f.type === "checkbox" ? (
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm transition-colors",
                    raw === true
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 hover:border-primary/30 hover:bg-secondary/60",
                  )}
                >
                  <input
                    id={f.name}
                    type="checkbox"
                    checked={raw === true}
                    onChange={(e) => setValue(f.name, e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      raw === true ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                    aria-hidden
                  >
                    {raw === true ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span>
                    {f.label}
                    {f.required ? " *" : ""}
                  </span>
                </label>
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
              {eventType.requiresPayment && eventType.price > 0
                ? "Continue to payment"
                : eventType.requiresConfirmation
                  ? "Request booking"
                  : "Confirm booking"}
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
