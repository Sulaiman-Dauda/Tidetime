"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe2,
  Loader2,
  MapPin,
  RefreshCw,
  UserRound,
  Users,
} from "lucide-react";
import type { BookingField, EventLocation } from "@/db/schema";
import { bookAction, type BookActionState } from "@/app/(public)/actions";
import { AltchaWidget } from "@/components/altcha-widget";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { validateResponses, type FieldValues } from "@/lib/booking-fields";
import { formatDuration, initials, WEEKDAY_SHORT } from "@/lib/format";
import { locationLabel } from "@/lib/locations";
import { cn } from "@/lib/utils";
import { listTimeZones } from "@/lib/timezones";

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

type Host = {
  id: number;
  name: string | null;
  username: string;
  avatarUrl?: string | null;
  /** public job title, e.g. "Consultant" */
  position?: string | null;
};

export type BookingPrefill = {
  name: string;
  email: string;
  responses: FieldValues;
  guests: string[];
};

export type LegalLink = { label: string; href: string; external: boolean };

/** First day of week (0=Sun) from the visitor's locale, when the browser knows it. */
function localeWeekStart(): number {
  try {
    const locale = new Intl.Locale(navigator.language);
    const info = (locale as unknown as { weekInfo?: { firstDay?: number } }).weekInfo
      ?? (locale as unknown as { getWeekInfo?: () => { firstDay?: number } }).getWeekInfo?.();
    // weekInfo.firstDay is 1-7 with 7 = Sunday
    if (info?.firstDay) return info.firstDay % 7;
  } catch {
    // fall through to Sunday
  }
  return 0;
}

type Props = {
  slug: string;
  teamSlug: string;
  rescheduleUid?: string;
  service: ServiceView;
  /** company branding shown at the top of the booking card */
  company: { name: string; logoUrl?: string | null };
  spamProtection?: boolean;
  botChallenge?: string;
  teamHosts?: Host[];
  /** When rescheduling, the existing booking's details so the booker doesn't re-enter them */
  prefill?: BookingPrefill;
  /** configured legal pages, linked in the consent microcopy under the submit button */
  legalLinks?: LegalLink[];
};

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthMatrix(year: number, month: number, weekStart: number): (Date | null)[] {
  const cells: (Date | null)[] = [];
  const firstWeekday = (new Date(year, month, 1).getDay() - weekStart + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let index = 0; index < firstWeekday; index += 1) cells.push(null);
  for (let date = 1; date <= daysInMonth; date += 1) {
    cells.push(new Date(year, month, date));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function timeZoneLabel(timeZone: string): string {
  const city = timeZone.split("/").at(-1)?.replaceAll("_", " ") ?? timeZone;
  try {
    const zoneName = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;
    return zoneName ? `${city} (${zoneName})` : city;
  } catch {
    return city;
  }
}

function parseGuestEmails(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function contactErrors(values: FieldValues, guests: string[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = typeof values.name === "string" ? values.name.trim() : "";
  const email = typeof values.email === "string" ? values.email.trim().toLowerCase() : "";
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!name) errors.name = "Enter your name";
  if (!email) errors.email = "Enter your email address";
  else if (!emailPattern.test(email)) errors.email = "Enter a valid email address";

  if (guests.some((guest) => !emailPattern.test(guest))) {
    errors.guests = "Enter valid guest email addresses";
  } else if (email && guests.includes(email)) {
    errors.guests = "A guest email must be different from your email";
  }

  return errors;
}

export function BookingFlow({
  slug,
  teamSlug,
  rescheduleUid,
  service,
  company,
  spamProtection,
  botChallenge,
  teamHosts = [],
  prefill,
  legalLinks = [],
}: Props) {
  const router = useRouter();
  const [duration, setDuration] = useState(service.length);
  const [timeZone, setTimeZone] = useState(service.scheduleTimeZone);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [slots, setSlots] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  // Day selection is remembered per month, so paging to another month and back
  // doesn't lose the choice.
  const [dayByMonth, setDayByMonth] = useState<Record<string, string>>({});
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [hour12, setHour12] = useState(true);
  const [weekStart, setWeekStart] = useState(0);
  const [step, setStep] = useState<"time" | "details">("time");
  const [nextAvailable, setNextAvailable] = useState<{ month: Date; day: string } | null>(null);
  // Preserved form answers after a slot conflict bounced the booker back.
  const [draft, setDraft] = useState<{ values: FieldValues; guests: string } | null>(null);
  const [conflictNotice, setConflictNotice] = useState(false);
  const slotCache = useRef<Record<string, Record<string, string[]>>>({});

  const monthKey = `${viewDate.getFullYear()}-${viewDate.getMonth()}`;
  const selectedDay = dayByMonth[monthKey] ?? null;
  const setSelectedDay = useCallback(
    (day: string | null) => {
      setDayByMonth((current) => {
        if (day === null) {
          if (!(monthKey in current)) return current;
          const next = { ...current };
          delete next[monthKey];
          return next;
        }
        return { ...current, [monthKey]: day };
      });
    },
    [monthKey],
  );

  useEffect(() => {
    try {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || service.scheduleTimeZone);
    } catch {
      // The schedule timezone remains the safe fallback.
    }
    setWeekStart(localeWeekStart());
  }, [service.scheduleTimeZone]);

  useEffect(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const start = dayKey(new Date(year, month, 1));
    const end = dayKey(new Date(year, month + 1, 0));
    const query = new URLSearchParams({
      team: teamSlug,
      slug,
      start,
      end,
      duration: String(duration),
      tz: timeZone,
    });
    if (providerId) query.set("host", String(providerId));

    const cacheKey = query.toString();
    const cached = slotCache.current[cacheKey];
    if (cached) {
      setSlots(cached);
      setSlotError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setSlotError(null);
    fetch(`/api/slots/team?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load availability");
        return (await response.json()) as { byDay?: Record<string, string[]> };
      })
      .then((data) => {
        const nextSlots = data.byDay ?? {};
        slotCache.current[cacheKey] = nextSlots;
        setSlots(nextSlots);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setSlots({});
        setSlotError("We couldn’t load availability for this month.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [teamSlug, slug, duration, timeZone, providerId, viewDate, reloadNonce]);

  useEffect(() => {
    if (loading || slotError || selectedDay) return;
    const firstAvailableDay = Object.keys(slots)
      .sort()
      .find((key) => slots[key]?.length);
    if (firstAvailableDay) setSelectedDay(firstAvailableDay);
  }, [loading, selectedDay, slotError, slots, setSelectedDay]);

  // When the visible month has no availability at all, probe ahead (up to six
  // months) so the empty state can offer a one-click jump to the next opening.
  useEffect(() => {
    const hasAvailability = Object.values(slots).some((day) => day.length > 0);
    if (loading || slotError || hasAvailability) {
      setNextAvailable(null);
      return;
    }
    let cancelled = false;
    (async () => {
      for (let offset = 1; offset <= 6 && !cancelled; offset += 1) {
        const probe = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
        const query = new URLSearchParams({
          team: teamSlug,
          slug,
          start: dayKey(probe),
          end: dayKey(new Date(probe.getFullYear(), probe.getMonth() + 1, 0)),
          duration: String(duration),
          tz: timeZone,
        });
        if (providerId) query.set("host", String(providerId));
        try {
          const cached = slotCache.current[query.toString()];
          const byDay =
            cached ??
            ((await (await fetch(`/api/slots/team?${query}`)).json()) as {
              byDay?: Record<string, string[]>;
            }).byDay ??
            {};
          slotCache.current[query.toString()] = byDay;
          const first = Object.keys(byDay)
            .sort()
            .find((key) => byDay[key]?.length);
          if (first) {
            if (!cancelled) setNextAvailable({ month: probe, day: first });
            return;
          }
        } catch {
          break;
        }
      }
      if (!cancelled) setNextAvailable(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, slotError, slots, viewDate, teamSlug, slug, duration, timeZone, providerId]);

  const durations = useMemo(
    () => [...new Set([service.length, ...service.durations])].sort((a, b) => a - b),
    [service.durations, service.length],
  );
  // The member profile shown in the sidebar: the explicitly chosen provider,
  // or the only provider when there is no choice to make.
  const displayHost = useMemo(
    () =>
      teamHosts.find((member) => member.id === providerId) ??
      (teamHosts.length === 1 ? teamHosts[0] : null),
    [teamHosts, providerId],
  );
  const timeZones = useMemo(() => listTimeZones(), []);
  const calendarDays = monthMatrix(viewDate.getFullYear(), viewDate.getMonth(), weekStart);
  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => WEEKDAY_SHORT[(i + weekStart) % 7]),
    [weekStart],
  );
  const today = dayKey(new Date());
  const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const canGoBack =
    new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getTime() >
    currentMonth.getTime();
  const daySlots = selectedDay ? slots[selectedDay] ?? [] : [];

  const finishBooking = useCallback(
    // confirmed=1 triggers the one-time success animation on the detail page.
    (uid: string) => router.push(`/booking/${uid}?confirmed=1`),
    [router],
  );

  function changeMonth(offset: number) {
    setViewDate(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
    // The per-month day selection survives paging; only the unconfirmed slot resets.
    setPendingSlot(null);
    setSelectedSlot(null);
  }

  /** Availability inputs changed — every remembered selection is stale. */
  function resetSelection() {
    setDayByMonth({});
    setPendingSlot(null);
    setSelectedSlot(null);
  }

  function chooseSlot(slot: string) {
    setSelectedSlot(slot);
    setConflictNotice(false);
    setStep("details");
  }

  const handleSlotTaken = useCallback((values: FieldValues, guests: string) => {
    setDraft({ values, guests });
    setConflictNotice(true);
    // The cached availability is what let the booker pick a dead slot — drop it.
    slotCache.current = {};
    setReloadNonce((value) => value + 1);
    setPendingSlot(null);
    setSelectedSlot(null);
    setStep("time");
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-10">
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_16px_40px_-24px_rgba(16,24,40,0.24)]">
        <div className="grid lg:grid-cols-[minmax(0,264px)_minmax(0,1fr)]">
          <aside className="border-b bg-muted/20 p-6 lg:min-h-[532px] lg:border-b-0 lg:border-r">
            {rescheduleUid ? (
              <div className="mb-5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                Rescheduling your booking
              </div>
            ) : null}

            {/* Company brand */}
            <div className="-mx-6 flex items-center gap-2.5 border-b border-border/60 px-6 pb-5">
              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logoUrl} alt={company.name} className="h-7 w-auto object-contain" />
              ) : (
                <Avatar className="h-7 w-7 border bg-background">
                  <AvatarFallback className="text-[10px] font-semibold">{initials(company.name)}</AvatarFallback>
                </Avatar>
              )}
              <span className="text-sm font-semibold tracking-tight">{company.name}</span>
            </div>

            {/* Member profile — follows the provider selection below */}
            {displayHost ? (
              <div className="mt-6">
                <Avatar className="h-14 w-14 border-2 border-background bg-background shadow-md ring-1 ring-border/60">
                  {displayHost.avatarUrl ? (
                    <AvatarImage src={displayHost.avatarUrl} alt={displayHost.name ?? displayHost.username} />
                  ) : null}
                  <AvatarFallback className="text-sm font-semibold">
                    {initials(displayHost.name ?? displayHost.username)}
                  </AvatarFallback>
                </Avatar>
                <p className="mt-3.5 text-sm font-medium text-muted-foreground">
                  {displayHost.name ?? displayHost.username}
                </p>
                {displayHost.position ? (
                  <p className="mt-0.5 text-xs text-muted-foreground/80">{displayHost.position}</p>
                ) : null}
              </div>
            ) : teamHosts.length > 1 ? (
              <div className="mt-6">
                <div className="flex -space-x-2.5">
                  {teamHosts.slice(0, 4).map((member) => (
                    <Avatar
                      key={member.id}
                      className="h-11 w-11 border-2 border-card bg-background shadow-sm"
                    >
                      {member.avatarUrl ? (
                        <AvatarImage src={member.avatarUrl} alt={member.name ?? member.username} />
                      ) : null}
                      <AvatarFallback className="text-xs font-semibold">
                        {initials(member.name ?? member.username)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <p className="mt-3.5 text-sm font-medium text-muted-foreground">Any available provider</p>
              </div>
            ) : null}

            <h1
              className={cn(
                "text-xl font-semibold tracking-tight",
                displayHost || teamHosts.length > 1 ? "mt-1" : "mt-6",
              )}
            >
              {service.title}
            </h1>
            {service.description ? (
              <p className="mt-2.5 text-[13px] leading-6 text-muted-foreground">
                {service.description}
              </p>
            ) : null}

            <div className="mt-5 space-y-2.5 text-[13px] text-muted-foreground">
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground/80" />
                <span>{formatDuration(duration)}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground/80" />
                <span>{locationLabel(service.locations[0])}</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Globe2 className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground/80" />
                <Select
                  value={timeZone}
                  onValueChange={(value) => {
                    setTimeZone(value);
                    resetSelection();
                  }}
                >
                  <SelectTrigger
                    aria-label="Timezone"
                    className="h-7 min-w-0 border-0 bg-transparent px-0 text-[13px] shadow-none focus:ring-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {timeZones.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {timeZoneLabel(zone)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {service.requiresConfirmation ? (
              <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs leading-5 text-amber-700 dark:text-amber-300">
                Your request will be confirmed after submission.
              </div>
            ) : null}

            {teamHosts.length > 1 && step === "time" ? (
              <div className="mt-6">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Provider</Label>
                <Select
                  value={providerId ? String(providerId) : "any"}
                  onValueChange={(value) => {
                    setProviderId(value === "any" ? null : Number(value));
                    resetSelection();
                  }}
                >
                  <SelectTrigger className="mt-1.5 h-9 w-full bg-background text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any available provider</SelectItem>
                    {teamHosts.map((member) => (
                      <SelectItem key={member.id} value={String(member.id)}>
                        {member.name ?? member.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {durations.length > 1 && step === "time" ? (
              <div className="mt-5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Duration</Label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {durations.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setDuration(value);
                        resetSelection();
                      }}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                        duration === value
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-background hover:border-primary/40 hover:text-primary",
                      )}
                    >
                      {formatDuration(value)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>

          <section className="min-w-0 p-6">
            {step === "details" && selectedSlot ? (
              <BookingForm
                slug={slug}
                teamSlug={teamSlug}
                service={service}
                duration={duration}
                timeZone={timeZone}
                hour12={hour12}
                slot={selectedSlot}
                provider={displayHost}
                anyProvider={!displayHost && teamHosts.length > 1}
                preferredHostId={providerId ?? undefined}
                rescheduleUid={rescheduleUid}
                spamProtection={spamProtection}
                botChallenge={botChallenge}
                prefill={prefill}
                draft={draft}
                legalLinks={legalLinks}
                onSlotTaken={handleSlotTaken}
                onBack={() => setStep("time")}
                onBooked={finishBooking}
              />
            ) : (
              <>
                {conflictNotice ? (
                  <div
                    role="alert"
                    className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
                  >
                    <p className="font-semibold">That time was just taken</p>
                    <p className="mt-0.5 text-[13px]">
                      Someone booked it while you were filling in your details. Your answers are
                      saved — just pick another time.
                    </p>
                  </div>
                ) : null}
                <h2 className="text-lg font-semibold tracking-tight">Select a date &amp; time</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  Times are shown in your selected timezone.
                </p>

                <div className="mt-5 grid gap-6 md:grid-cols-[minmax(272px,1fr)_188px]">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-[13px] font-semibold" suppressHydrationWarning>
                        {viewDate.toLocaleDateString(undefined, {
                          month: "long",
                          year: "numeric",
                        })}
                      </h3>
                      <div className="flex gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          disabled={!canGoBack}
                          onClick={() => changeMonth(-1)}
                          aria-label="Previous month"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => changeMonth(1)}
                          aria-label="Next month"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-7 gap-1 text-center">
                      {weekdays.map((weekday) => (
                        <div
                          key={weekday}
                          className="py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70"
                        >
                          {weekday.slice(0, 1)}
                        </div>
                      ))}
                    </div>
                    {loading && Object.keys(slots).length === 0 ? (
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: 35 }, (_, index) => (
                          <Skeleton key={index} className="aspect-square rounded-full" />
                        ))}
                      </div>
                    ) : null}
                    <div className={cn("grid grid-cols-7 gap-1", loading && Object.keys(slots).length === 0 && "hidden")}>
                      {calendarDays.map((date, index) => {
                        if (!date) return <div key={`empty-${index}`} />;
                        const key = dayKey(date);
                        const available = (slots[key]?.length ?? 0) > 0;
                        const past = key < today;
                        const selected = key === selectedDay;

                        return (
                          <button
                            key={key}
                            type="button"
                            data-testid={available && !past ? "day-available" : undefined}
                            disabled={!available || past || loading}
                            aria-label={date.toLocaleDateString(undefined, {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                            })}
                            aria-pressed={selected}
                            onClick={() => {
                              setSelectedDay(key);
                              setPendingSlot(null);
                              setSelectedSlot(null);
                            }}
                            className={cn(
                              "relative aspect-square rounded-full text-[13px] font-medium transition",
                              selected &&
                                "bg-primary text-primary-foreground shadow-sm shadow-primary/20",
                              !selected &&
                                available &&
                                !past &&
                                "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
                              (!available || past) && "cursor-default text-muted-foreground/35",
                            )}
                          >
                            {date.getDate()}
                            {available && !past && !selected ? (
                              <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    {loading ? (
                      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading availability…
                      </div>
                    ) : null}

                    {!loading && !slotError && nextAvailable ? (
                      <div className="mt-4 rounded-xl border border-dashed border-border/80 bg-muted/30 px-4 py-3 text-center">
                        <p className="text-xs text-muted-foreground">
                          No availability this month.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            const key = `${nextAvailable.month.getFullYear()}-${nextAvailable.month.getMonth()}`;
                            setViewDate(nextAvailable.month);
                            setDayByMonth((current) => ({ ...current, [key]: nextAvailable.day }));
                            setPendingSlot(null);
                            setSelectedSlot(null);
                          }}
                        >
                          Next available:{" "}
                          {new Date(`${nextAvailable.day}T12:00:00`).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-0 border-t pt-5 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                    <div className="flex min-h-8 items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[13px] font-semibold">
                        <Calendar className="h-4 w-4 text-muted-foreground/80" />
                        {selectedDay
                          ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })
                          : "Select a date"}
                      </div>
                      <div
                        className="flex overflow-hidden rounded-md border border-border/80 text-[11px] font-semibold"
                        role="group"
                        aria-label="Time format"
                      >
                        <button
                          type="button"
                          aria-pressed={hour12}
                          onClick={() => setHour12(true)}
                          className={cn(
                            "px-1.5 py-0.5 transition",
                            hour12 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          12h
                        </button>
                        <button
                          type="button"
                          aria-pressed={!hour12}
                          onClick={() => setHour12(false)}
                          className={cn(
                            "px-1.5 py-0.5 transition",
                            !hour12 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          24h
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 max-h-[344px] space-y-1.5 overflow-y-auto pr-1">
                      {loading ? (
                        Array.from({ length: 6 }, (_, index) => (
                          <Skeleton key={index} className="h-10 w-full rounded-lg" />
                        ))
                      ) : slotError ? (
                        <div className="rounded-lg border border-dashed p-4 text-sm">
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                          <p className="mt-2 font-medium">Couldn’t load times</p>
                          <p className="mt-1 text-xs text-muted-foreground">{slotError}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={() => setReloadNonce((value) => value + 1)}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Try again
                          </Button>
                        </div>
                      ) : !selectedDay ? (
                        <p className="py-10 text-center text-xs leading-5 text-muted-foreground">
                          Choose an available date to see times.
                        </p>
                      ) : daySlots.length === 0 ? (
                        <p className="py-10 text-center text-xs text-muted-foreground">
                          No times available on this date.
                        </p>
                      ) : (
                        daySlots.map((slot) => {
                          const label = new Date(slot).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12,
                            timeZone,
                          });
                          // Calendly-style confirm: the first click arms the slot,
                          // splitting it into the time + an explicit Next button.
                          return pendingSlot === slot ? (
                            <div key={slot} className="flex gap-1.5">
                              <div className="flex-1 select-none rounded-lg border border-transparent bg-muted py-2.5 text-center text-[13px] font-semibold text-muted-foreground">
                                {label}
                              </div>
                              <button
                                type="button"
                                data-testid="slot-confirm"
                                autoFocus
                                onClick={() => chooseSlot(slot)}
                                className="flex-1 rounded-lg bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.99]"
                              >
                                Next
                              </button>
                            </div>
                          ) : (
                            <button
                              key={slot}
                              type="button"
                              data-testid="slot"
                              onClick={() => setPendingSlot(slot)}
                              className="w-full rounded-lg border border-input bg-background py-2.5 text-[13px] font-semibold text-foreground transition hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-[0.99]"
                            >
                              {label}
                            </button>
                          );
                        })
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
  slug,
  teamSlug,
  service,
  duration,
  timeZone,
  hour12,
  slot,
  provider,
  anyProvider,
  preferredHostId,
  rescheduleUid,
  spamProtection,
  botChallenge,
  prefill,
  draft,
  legalLinks = [],
  onSlotTaken,
  onBack,
  onBooked,
}: {
  slug: string;
  teamSlug: string;
  service: ServiceView;
  duration: number;
  timeZone: string;
  hour12: boolean;
  slot: string;
  /** the provider this meeting will be with, when known */
  provider?: Host | null;
  /** multiple providers and none chosen — round-robin assigns one */
  anyProvider?: boolean;
  preferredHostId?: number;
  rescheduleUid?: string;
  spamProtection?: boolean;
  botChallenge?: string;
  prefill?: BookingPrefill;
  /** answers preserved from a submit that lost its slot */
  draft?: { values: FieldValues; guests: string } | null;
  legalLinks?: LegalLink[];
  onSlotTaken: (values: FieldValues, guests: string) => void;
  onBack: () => void;
  onBooked: (uid: string) => void;
}) {
  const [state, formAction, pending] = useActionState<BookActionState, FormData>(
    bookAction,
    null,
  );
  const [values, setValues] = useState<FieldValues>(() =>
    draft
      ? draft.values
      : {
          ...(prefill?.responses ?? {}),
          name: prefill?.name ?? "",
          email: prefill?.email ?? "",
        },
  );
  const [guestEmails, setGuestEmails] = useState(() =>
    draft ? draft.guests : (prefill?.guests ?? []).join(", "),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [altcha, setAltcha] = useState<string | null>(null);
  const renderedAt = useRef(Date.now());
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const guestsRef = useRef(guestEmails);
  guestsRef.current = guestEmails;

  useEffect(() => {
    if (state?.uid) onBooked(state.uid);
  }, [state?.uid, onBooked]);

  // The slot was taken mid-form: hand the answers back to the parent so the
  // booker can pick a new time without retyping anything.
  useEffect(() => {
    if (state?.conflict) onSlotTaken(valuesRef.current, guestsRef.current);
  }, [state, onSlotTaken]);

  const customFields = service.bookingFields.filter(
    (field) => !["name", "email"].includes(field.name),
  );

  function setValue(name: string, value: string | boolean) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function submit(formData: FormData) {
    const guests = service.disableGuests ? [] : parseGuestEmails(guestEmails);
    const nextErrors = {
      ...contactErrors(values, guests),
      ...validateResponses(service.bookingFields, values),
      ...(spamProtection && !altcha
        ? { altcha: "Please wait for human verification to finish" }
        : {}),
    };

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    const payload = {
      slug,
      teamSlug,
      start: slot,
      duration,
      timeZone,
      name: String(values.name ?? "").trim(),
      email: String(values.email ?? "").trim().toLowerCase(),
      responses: values,
      guests: guests.length > 0 ? guests : undefined,
      preferredHostId,
      rescheduleUid,
      hp: formData.get("company") ?? "",
      ts: renderedAt.current,
      bc: botChallenge,
      altcha: altcha ?? undefined,
    };
    formData.set("payload", JSON.stringify(payload));
    formAction(formData);
  }

  return (
    <div className="max-w-2xl">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to date and time
      </button>

      <div className="mt-4 rounded-xl border border-border/70 bg-muted/30 p-3.5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[15px] font-semibold">
              {new Date(slot).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                timeZone,
              })}
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {new Date(slot).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
                hour12,
                timeZone,
              })}
              {" · "}
              {formatDuration(duration)}
              {" · "}
              {timeZoneLabel(timeZone)}
            </p>
          </div>
        </div>
        {provider || anyProvider ? (
          <div className="mt-3 flex items-center gap-2.5 border-t border-border/60 pt-3">
            {provider ? (
              <>
                <Avatar className="h-8 w-8 border bg-background">
                  {provider.avatarUrl ? (
                    <AvatarImage src={provider.avatarUrl} alt={provider.name ?? provider.username} />
                  ) : null}
                  <AvatarFallback className="text-[10px] font-semibold">
                    {initials(provider.name ?? provider.username)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">
                    {provider.name ?? provider.username}
                  </p>
                  {provider.position ? (
                    <p className="truncate text-xs text-muted-foreground">{provider.position}</p>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Users className="h-4 w-4" />
                </div>
                <p className="text-[13px] text-muted-foreground">
                  With the first available provider
                </p>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold tracking-tight">Enter your details</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          We’ll send the confirmation and calendar invite to your email.
        </p>
      </div>

      <form action={submit} className="mt-5 space-y-4" noValidate>
        <div
          aria-hidden="true"
          className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden"
        >
          <label htmlFor="company">Company</label>
          <input id="company" name="company" tabIndex={-1} autoComplete="off" />
        </div>

        <FormField label="Your name" htmlFor="name" required error={errors.name}>
          <Input
            id="name"
            autoComplete="name"
            autoFocus
            aria-invalid={Boolean(errors.name)}
            value={String(values.name ?? "")}
            onChange={(event) => setValue("name", event.target.value)}
          />
        </FormField>

        <FormField label="Email address" htmlFor="email" required error={errors.email}>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            value={String(values.email ?? "")}
            onChange={(event) => setValue("email", event.target.value)}
          />
        </FormField>

        {!service.disableGuests ? (
          <FormField
            label="Invite guests"
            htmlFor="guests"
            hint="Optional — separate multiple addresses with commas"
            error={errors.guests}
          >
            <div className="relative">
              <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Textarea
                id="guests"
                rows={2}
                className="pl-9"
                placeholder="guest@example.com"
                value={guestEmails}
                onChange={(event) => {
                  setGuestEmails(event.target.value);
                  setErrors((current) => {
                    if (!current.guests) return current;
                    const next = { ...current };
                    delete next.guests;
                    return next;
                  });
                }}
              />
            </div>
          </FormField>
        ) : null}

        {customFields.map((field) => (
          <CustomField
            key={field.name}
            field={field}
            value={values[field.name]}
            error={errors[field.name]}
            onChange={(value) => setValue(field.name, value)}
          />
        ))}

        {spamProtection ? (
          <div className="space-y-1.5">
            <AltchaWidget onChange={setAltcha} />
            {errors.altcha ? (
              <p className="text-xs text-destructive">{errors.altcha}</p>
            ) : null}
          </div>
        ) : null}

        {state?.error && !state.conflict ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {state.error}
          </div>
        ) : null}

        <Button
          type="submit"
          data-testid="confirm-booking"
          size="lg"
          className="w-full rounded-xl"
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : service.requiresConfirmation ? (
            <UserRound className="h-4 w-4" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {pending
            ? "Scheduling…"
            : service.requiresConfirmation
              ? "Request booking"
              : "Confirm booking"}
        </Button>

        <p className="text-center text-xs leading-5 text-muted-foreground">
          By continuing, you agree to receive emails about this booking
          {legalLinks.length > 0 ? (
            <>
              {" "}
              and accept our{" "}
              {legalLinks.map((link, index) => (
                <span key={link.label}>
                  {index > 0 ? (index === legalLinks.length - 1 ? " and " : ", ") : null}
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {link.label}
                  </a>
                </span>
              ))}
            </>
          ) : null}
          .
        </p>
      </form>
    </div>
  );
}

function CustomField({
  field,
  value,
  error,
  onChange,
}: {
  field: BookingField;
  value: FieldValues[string];
  error?: string;
  onChange: (value: string | boolean) => void;
}) {
  if (field.type === "checkbox") {
    const checked = value === true;
    return (
      <div>
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm transition",
            checked
              ? "border-primary bg-primary/[0.06]"
              : "border-border hover:border-primary/40",
          )}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
              checked
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background",
            )}
          >
            {checked ? <Check className="h-3.5 w-3.5" /> : null}
          </span>
          <span>
            {field.label}
            {field.required ? " *" : ""}
          </span>
        </label>
        {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  const inputType =
    field.type === "phone"
      ? "tel"
      : field.type === "number"
        ? "number"
        : field.type === "email"
          ? "email"
          : "text";

  return (
    <FormField
      label={field.label}
      htmlFor={field.name}
      required={field.required}
      hint={field.type === "phone" ? "Include your country code, e.g. +44" : undefined}
      error={error}
    >
      {field.type === "textarea" ? (
        <Textarea
          id={field.name}
          rows={4}
          aria-invalid={Boolean(error)}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={field.name}
          type={inputType}
          inputMode={field.type === "phone" ? "tel" : field.type === "number" ? "numeric" : undefined}
          autoComplete={field.type === "phone" ? "tel" : undefined}
          placeholder={field.type === "phone" ? "+44 7700 900123" : undefined}
          aria-invalid={Boolean(error)}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </FormField>
  );
}

function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
