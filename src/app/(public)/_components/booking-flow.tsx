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
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe2,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import type { BookingField, EventLocation } from "@/db/schema";
import { bookAction, type BookActionState } from "@/app/(public)/actions";
import { AltchaWidget } from "@/components/altcha-widget";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, fieldClassName } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
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
import {
  DEFAULT_DIALLING_COUNTRY,
  DIALLING_COUNTRIES,
  countryFor,
  normalizeDiallingCountry,
  splitE164,
  toE164,
} from "@/lib/phone";
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
  /** ISO country preselected in phone fields, from Settings → Brand & company */
  phoneCountry?: string;
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

function formatTime(iso: string | Date, timeZone: string, hour12: boolean): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12,
    timeZone,
  });
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

/**
 * The company brand at the top of the booking card: the logo when there is
 * one, otherwise the name. Never both, because a logo nearly always carries
 * the name already and the pair read as the brand twice.
 */
function CompanyBrand({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt={name} className="h-8 w-auto max-w-48 object-contain object-left" />
    );
  }
  return <p className="text-base font-semibold tracking-tight text-foreground">{name}</p>;
}

function hostName(host: Host): string {
  return host.name ?? host.username;
}

function locationIcon(type: EventLocation["type"]) {
  if (type === "in_person") return <MapPin />;
  if (type === "phone" || type === "attendee_phone") return <Phone />;
  return <Video />;
}

/** One fact about the service (duration, location, timezone) beside its icon. */
function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex min-h-6 items-center gap-2.5">
      <span className="flex shrink-0 text-muted-foreground [&_svg]:size-4" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
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
  phoneCountry = DEFAULT_DIALLING_COUNTRY,
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
  const monthHasTimes = Object.values(slots).some((day) => day.length > 0);
  const firstLoad = loading && Object.keys(slots).length === 0;
  const location = service.locations[0];

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
    setSelectedSlot(null);
  }

  /** Availability inputs changed, so every remembered selection is stale. */
  function resetSelection() {
    setDayByMonth({});
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
    // The cached availability is what let the booker pick a dead slot, so drop it.
    slotCache.current = {};
    setReloadNonce((value) => value + 1);
    setSelectedSlot(null);
    setStep("time");
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 bg-card pb-8 sm:bg-transparent sm:px-6 sm:py-10 lg:py-14">
      <div className="overflow-hidden bg-card text-card-foreground sm:rounded-2xl sm:shadow-popover">
        <div className="grid lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="border-b p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <CompanyBrand name={company.name} logoUrl={company.logoUrl} />

            {rescheduleUid ? (
              <Badge variant="info" className="mt-5">
                Rescheduling your booking
              </Badge>
            ) : null}

            <div className="mt-6">
              {/* Follows the provider selection below. */}
              {displayHost ? (
                <div className="mb-4 flex items-center gap-3">
                  <Avatar className="size-10">
                    {displayHost.avatarUrl ? (
                      <AvatarImage src={displayHost.avatarUrl} alt={hostName(displayHost)} />
                    ) : null}
                    <AvatarFallback className="text-sm">
                      {initials(hostName(displayHost))}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {hostName(displayHost)}
                    </p>
                    {displayHost.position ? (
                      <p className="truncate text-meta text-muted-foreground">
                        {displayHost.position}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : teamHosts.length > 1 ? (
                <div className="mb-4 flex -space-x-2">
                  {teamHosts.slice(0, 4).map((member) => (
                    <Avatar
                      key={member.id}
                      title={hostName(member)}
                      className="size-9 ring-2 ring-card"
                    >
                      {member.avatarUrl ? (
                        <AvatarImage src={member.avatarUrl} alt={hostName(member)} />
                      ) : null}
                      <AvatarFallback>{initials(hostName(member))}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              ) : null}

              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {service.title}
              </h1>
              {service.description ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {service.description}
                </p>
              ) : null}
            </div>

            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              <InfoRow icon={<Clock />}>
                {durations.length > 1 && step === "time" ? (
                  <Segmented
                    size="sm"
                    aria-label="Duration"
                    value={String(duration)}
                    onValueChange={(value) => {
                      setDuration(Number(value));
                      resetSelection();
                    }}
                    options={durations.map((value) => ({
                      value: String(value),
                      label: formatDuration(value),
                    }))}
                  />
                ) : (
                  formatDuration(duration)
                )}
              </InfoRow>
              {location ? (
                <InfoRow icon={locationIcon(location.type)}>{locationLabel(location)}</InfoRow>
              ) : null}
              <InfoRow icon={<Globe2 />}>
                <Select
                  value={timeZone}
                  onValueChange={(value) => {
                    setTimeZone(value);
                    resetSelection();
                  }}
                >
                  <SelectTrigger
                    aria-label="Timezone"
                    className="h-6 w-auto max-w-full gap-1 border-0 bg-transparent px-0 text-muted-foreground shadow-none transition-colors hover:text-foreground"
                  >
                    {/* Labels passed in so they are in the server HTML; Radix only
                        fills an empty SelectValue after hydration. */}
                    <SelectValue>{timeZoneLabel(timeZone)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {timeZones.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {timeZoneLabel(zone)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </InfoRow>
            </ul>

            {service.requiresConfirmation ? (
              <p className="mt-5 rounded-lg bg-warning-subtle px-3 py-2 text-meta text-warning">
                Your request will be confirmed after submission.
              </p>
            ) : null}

            {teamHosts.length > 1 && step === "time" ? (
              <Field label="Provider" htmlFor="provider" className="mt-6">
                <Select
                  value={providerId ? String(providerId) : "any"}
                  onValueChange={(value) => {
                    setProviderId(value === "any" ? null : Number(value));
                    resetSelection();
                  }}
                >
                  <SelectTrigger id="provider">
                    <SelectValue>
                      {displayHost ? hostName(displayHost) : "Any available provider"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any available provider</SelectItem>
                    {teamHosts.map((member) => (
                      <SelectItem key={member.id} value={String(member.id)}>
                        {hostName(member)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </aside>

          <section className="min-w-0 p-5 sm:p-6">
            {step === "details" && selectedSlot ? (
              <BookingForm
                slug={slug}
                teamSlug={teamSlug}
                service={service}
                duration={duration}
                timeZone={timeZone}
                hour12={hour12}
                slot={selectedSlot}
                preferredHostId={providerId ?? undefined}
                rescheduleUid={rescheduleUid}
                spamProtection={spamProtection}
                botChallenge={botChallenge}
                prefill={prefill}
                draft={draft}
                legalLinks={legalLinks}
                phoneCountry={phoneCountry}
                onSlotTaken={handleSlotTaken}
                onBack={() => setStep("time")}
                onBooked={finishBooking}
              />
            ) : (
              <>
                {conflictNotice ? (
                  <div
                    role="alert"
                    className="mb-5 rounded-lg bg-warning-subtle px-4 py-3 text-warning"
                  >
                    <p className="text-sm font-medium">That time was just taken</p>
                    <p className="mt-0.5 text-meta">
                      Someone booked it while you were filling in your details. Your answers
                      are saved, so just pick another time.
                    </p>
                  </div>
                ) : null}
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Select a date &amp; time
                </h2>

                <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_13rem] md:gap-8">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3
                        className="text-sm font-medium tabular-nums text-foreground"
                        suppressHydrationWarning
                      >
                        {viewDate.toLocaleDateString(undefined, {
                          month: "long",
                          year: "numeric",
                        })}
                      </h3>
                      <div className="-mr-1.5 flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={!canGoBack}
                          onClick={() => changeMonth(-1)}
                          aria-label="Previous month"
                        >
                          <ChevronLeft />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => changeMonth(1)}
                          aria-label="Next month"
                        >
                          <ChevronRight />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-7 text-center">
                      {weekdays.map((weekday) => (
                        <div
                          key={weekday}
                          className="pb-2 text-xs font-medium text-muted-foreground"
                        >
                          {weekday}
                        </div>
                      ))}
                    </div>
                    {firstLoad ? (
                      <div className="grid grid-cols-7 gap-y-1">
                        {Array.from({ length: 35 }, (_, index) => (
                          <Skeleton key={index} className="mx-auto size-10 rounded-full sm:size-11" />
                        ))}
                      </div>
                    ) : null}
                    <div className={cn("grid grid-cols-7 gap-y-1", firstLoad && "hidden")}>
                      {calendarDays.map((date, index) => {
                        if (!date) return <div key={`empty-${index}`} />;
                        const key = dayKey(date);
                        const available = (slots[key]?.length ?? 0) > 0;
                        const past = key < today;
                        const selected = key === selectedDay;
                        const bookable = available && !past;

                        return (
                          <button
                            key={key}
                            type="button"
                            data-testid={bookable ? "day-available" : undefined}
                            disabled={!bookable || loading}
                            aria-label={date.toLocaleDateString(undefined, {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                            })}
                            aria-pressed={selected}
                            onClick={() => {
                              setSelectedDay(key);
                              setSelectedSlot(null);
                            }}
                            className={cn(
                              "relative mx-auto flex size-10 items-center justify-center rounded-full text-sm tabular-nums transition-colors disabled:cursor-default sm:size-11",
                              selected
                                ? "bg-primary font-semibold text-primary-foreground"
                                : bookable
                                  ? "bg-accent font-semibold text-accent-foreground hover:ring-1 hover:ring-inset hover:ring-primary"
                                  : "text-muted-foreground/60",
                            )}
                          >
                            {date.getDate()}
                            {key === today ? (
                              <span
                                className="absolute bottom-1.5 size-1 rounded-full bg-current"
                                aria-hidden
                              />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    {loading ? (
                      <p className="mt-4 flex items-center justify-center gap-2 text-meta text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" />
                        Loading availability…
                      </p>
                    ) : null}

                    {!loading && !slotError && nextAvailable ? (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border bg-muted/40 px-4 py-3">
                        <p className="text-sm text-muted-foreground">No availability this month.</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const key = `${nextAvailable.month.getFullYear()}-${nextAvailable.month.getMonth()}`;
                            setViewDate(nextAvailable.month);
                            setDayByMonth((current) => ({ ...current, [key]: nextAvailable.day }));
                            setSelectedSlot(null);
                          }}
                        >
                          Next available:{" "}
                          {new Date(`${nextAvailable.day}T12:00:00`).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                          <ChevronRight />
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-0 border-t pt-5 md:border-t-0 md:pt-0">
                    <div className="flex h-8 items-center justify-between gap-3">
                      {/* The date shares a narrow column with the 12h/24h
                          toggle; without nowrap it breaks after the weekday. */}
                      <p className="whitespace-nowrap text-sm font-medium text-foreground">
                        {selectedDay
                          ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })
                          : "Select a date"}
                      </p>
                      <Segmented
                        size="sm"
                        aria-label="Time format"
                        value={hour12 ? "12h" : "24h"}
                        onValueChange={(value) => setHour12(value === "12h")}
                        options={[
                          { value: "12h", label: "12h" },
                          { value: "24h", label: "24h" },
                        ]}
                      />
                    </div>

                    {/* The list scrolls on wider screens. Its negative margins
                        keep focus rings unclipped and the scrollbar in the gap,
                        so the buttons stay flush with the header above. */}
                    <div className="mt-3 md:-mx-1 md:-mr-3 md:max-h-80 md:overflow-y-auto md:px-1 md:pr-3">
                      {loading ? (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-1">
                          {Array.from({ length: 6 }, (_, index) => (
                            <Skeleton key={index} className="h-10 rounded-lg" />
                          ))}
                        </div>
                      ) : slotError ? (
                        <div className="flex flex-col items-center px-2 py-8 text-center">
                          <AlertTriangle className="size-5 text-warning" />
                          <p className="mt-2 text-sm font-medium text-foreground">
                            Couldn’t load times
                          </p>
                          <p className="mt-1 text-meta text-muted-foreground">{slotError}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={() => setReloadNonce((value) => value + 1)}
                          >
                            <RefreshCw />
                            Try again
                          </Button>
                        </div>
                      ) : !selectedDay || daySlots.length === 0 ? (
                        <p className="px-2 py-10 text-center text-meta text-muted-foreground">
                          {!monthHasTimes
                            ? "No times available this month."
                            : !selectedDay
                              ? "Choose an available date to see times."
                              : "No times available on this date."}
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 py-1 sm:grid-cols-4 md:grid-cols-1">
                          {daySlots.map((slot) => (
                            // One click goes to the form. Arming the slot first
                            // and confirming with a Next button cost a second tap
                            // on every booking to guard against a mistake the
                            // form that follows already catches.
                            <button
                              key={slot}
                              type="button"
                              data-testid="slot"
                              onClick={() => chooseSlot(slot)}
                              className={cn(
                                "flex h-10 items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition-colors",
                                slot === selectedSlot
                                  ? "border-primary bg-accent text-accent-foreground"
                                  : "border-input bg-background text-foreground shadow-xs hover:border-primary hover:text-primary",
                              )}
                            >
                              {formatTime(slot, timeZone, hour12)}
                            </button>
                          ))}
                        </div>
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
  preferredHostId,
  rescheduleUid,
  spamProtection,
  botChallenge,
  prefill,
  draft,
  legalLinks = [],
  phoneCountry,
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
  preferredHostId?: number;
  rescheduleUid?: string;
  spamProtection?: boolean;
  botChallenge?: string;
  prefill?: BookingPrefill;
  /** answers preserved from a submit that lost its slot */
  draft?: { values: FieldValues; guests: string } | null;
  legalLinks?: LegalLink[];
  phoneCountry: string;
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

  /** Width for a field rendered outside the custom loop, so name and email
   *  follow the same setting as everything else rather than ignoring it. */
  function widthOf(name: string): "full" | "half" {
    return service.bookingFields.find((f) => f.name === name)?.width ?? "full";
  }

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

  const end = new Date(new Date(slot).getTime() + duration * 60_000);

  return (
    <div className="max-w-xl">
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        Enter your details
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We’ll send the confirmation and calendar invite to your email.
      </p>

      <div className="mt-5 flex items-center gap-3 rounded-lg border bg-muted/40 py-3 pl-4 pr-3">
        <CalendarDays className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {new Date(slot).toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone,
            })}
          </p>
          <p className="text-meta tabular-nums text-muted-foreground">
            {formatTime(slot, timeZone, hour12)} – {formatTime(end, timeZone, hour12)}
            {" · "}
            {timeZoneLabel(timeZone)}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          aria-label="Change date and time"
        >
          Change
        </Button>
      </div>

      <form action={submit} className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5" noValidate>
        <div aria-hidden="true" className="sr-only">
          <label htmlFor="company">Company</label>
          <input id="company" name="company" tabIndex={-1} autoComplete="off" />
        </div>

        <div className={widthOf("name") === "half" ? "col-span-2 sm:col-span-1" : "col-span-2"}>
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
        </div>

        <div className={widthOf("email") === "half" ? "col-span-2 sm:col-span-1" : "col-span-2"}>
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
        </div>

        {!service.disableGuests ? (
          <div className="col-span-2">
            <FormField
              label="Invite guests"
              htmlFor="guests"
              hint="Optional. Separate addresses with commas."
              error={errors.guests}
            >
              <div className="relative">
                <Users className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden />
                <Textarea
                  id="guests"
                  rows={2}
                  className="min-h-0 pl-9"
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
          </div>
        ) : null}

        {customFields.map((field) => (
          <div
            key={field.name}
            className={field.width === "half" ? "col-span-2 sm:col-span-1" : "col-span-2"}
          >
            <CustomField
              field={field}
              phoneCountry={phoneCountry}
              value={values[field.name]}
              error={errors[field.name]}
              onChange={(value) => setValue(field.name, value)}
            />
          </div>
        ))}

        {spamProtection ? (
          <div className="col-span-2 grid gap-1.5">
            <AltchaWidget onChange={setAltcha} />
            {errors.altcha ? (
              <p className="text-meta text-destructive">{errors.altcha}</p>
            ) : null}
          </div>
        ) : null}

        {state?.error && !state.conflict ? (
          <div
            role="alert"
            className="col-span-2 rounded-lg bg-destructive-subtle px-4 py-3 text-sm text-destructive"
          >
            {state.error}
          </div>
        ) : null}

        <div className="col-span-2 mt-1 grid gap-3">
          <Button
            type="submit"
            data-testid="confirm-booking"
            size="lg"
            className="w-full"
            loading={pending}
          >
            {pending ? null : service.requiresConfirmation ? <UserRound /> : <Check />}
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
        </div>
      </form>
    </div>
  );
}

/**
 * Country picker plus national number, so the booker never has to know or type
 * a dialling code. The country defaults to the company's setting, which means
 * most people leave it alone entirely. The value handed upward is E.164
 * (`+447700900123`) once it parses, and the raw digits until then, so
 * validation can report a half-finished number.
 */
function PhoneField({
  field,
  value,
  error,
  defaultCountry,
  onChange,
}: {
  field: BookingField;
  value: FieldValues[string];
  error?: string;
  defaultCountry: string;
  onChange: (value: string) => void;
}) {
  // Local state owns the input after mount: pushing a partially typed number
  // up and re-deriving from it would fight the user mid-keystroke.
  const initial = typeof value === "string" ? value : "";
  const [country, setCountry] = useState(() => {
    const parts = initial ? splitE164(initial, defaultCountry) : null;
    return parts?.country ?? normalizeDiallingCountry(defaultCountry);
  });
  const [national, setNational] = useState(() => {
    const parts = initial ? splitE164(initial, defaultCountry) : null;
    return parts?.national ?? initial;
  });

  function push(nextNational: string, nextCountry: string) {
    onChange(toE164(nextNational, nextCountry) ?? nextNational.trim());
  }

  return (
    <FormField
      label={field.label}
      htmlFor={field.name}
      required={field.required}
      hint={field.hint}
      error={error}
    >
      <div className="flex gap-2">
        {/* The trigger stays narrow (just the dialling code) while the list
            shows full country names, so people can find "France" without
            knowing it is FR. Typing in the open list jumps by name. */}
        <Select
          value={country}
          onValueChange={(next) => {
            setCountry(next);
            push(national, next);
          }}
        >
          <SelectTrigger aria-label="Country dialling code" className="w-24 shrink-0 tabular-nums">
            <SelectValue>+{countryFor(country).dial}</SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {DIALLING_COUNTRIES.map((option) => (
              <SelectItem key={option.code} value={option.code}>
                {option.name} +{option.dial}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id={field.name}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={country === "GB" ? "7700 900123" : undefined}
          aria-invalid={Boolean(error)}
          value={national}
          onChange={(event) => {
            setNational(event.target.value);
            push(event.target.value, country);
          }}
        />
      </div>
    </FormField>
  );
}

function CustomField({
  field,
  value,
  error,
  phoneCountry,
  onChange,
}: {
  field: BookingField;
  value: FieldValues[string];
  error?: string;
  phoneCountry: string;
  onChange: (value: string | boolean) => void;
}) {
  if (field.type === "phone") {
    return (
      <PhoneField
        field={field}
        value={value}
        error={error}
        defaultCountry={phoneCountry}
        onChange={onChange}
      />
    );
  }

  if (field.type === "checkbox") {
    const checked = value === true;
    return (
      <div className="grid gap-1.5">
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm text-foreground transition-colors",
            checked ? "border-primary bg-accent" : "hover:border-primary/50",
          )}
        >
          <input
            type="checkbox"
            className="peer sr-only"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span
            className={cn(
              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border shadow-xs peer-focus-visible:ring-4 peer-focus-visible:ring-ring/25",
              checked
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background",
            )}
          >
            {checked ? <Check className="size-3" strokeWidth={3} /> : null}
          </span>
          <span>
            {field.label}
            {field.required ? <RequiredMark /> : null}
          </span>
        </label>
        {error ? <p className="text-meta text-destructive">{error}</p> : null}
      </div>
    );
  }

  // Phone is handled above by PhoneField.
  const inputType =
    field.type === "number"
      ? "number"
      : field.type === "email"
        ? "email"
        : field.type === "date"
          ? "date"
          : "text";

  return (
    <FormField
      label={field.label}
      htmlFor={field.name}
      required={field.required}
      hint={field.hint}
      error={error}
    >
      {field.type === "textarea" ? (
        <Textarea
          id={field.name}
          rows={3}
          aria-invalid={Boolean(error)}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.type === "select" ? (
        <select
          id={field.name}
          aria-invalid={Boolean(error)}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className={cn(fieldClassName, "h-9 px-3")}
        >
          <option value="">Choose…</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : (
        <Input
          id={field.name}
          type={inputType}
          inputMode={field.type === "number" ? "numeric" : undefined}
          aria-invalid={Boolean(error)}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </FormField>
  );
}

function RequiredMark() {
  return (
    <span className="text-muted-foreground" aria-hidden>
      {" *"}
    </span>
  );
}

/** Field with the booking form's required marker and inline error. */
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
    <Field
      label={
        <>
          {label}
          {required ? <RequiredMark /> : null}
        </>
      }
      htmlFor={htmlFor}
      hint={error ? undefined : hint}
    >
      {children}
      {error ? <p className="text-meta text-destructive">{error}</p> : null}
    </Field>
  );
}
