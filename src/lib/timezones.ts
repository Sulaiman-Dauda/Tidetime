/** A curated, deduplicated list of common IANA timezones for selects. */
export function listTimeZones(): string[] {
  // Use the runtime-supported set when available (Node 22 / modern browsers).
  const sv = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
  if (typeof sv === "function") {
    try {
      return sv("timeZone");
    } catch {
      /* fall through */
    }
  }
  return COMMON_TIMEZONES;
}

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Istanbul",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function guessTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * DST-aware abbreviation for a zone at a given instant, e.g. "EDT" / "EST",
 * "GMT+1". Falls back to an empty string if the runtime can't resolve it.
 */
export function timeZoneAbbreviation(timeZone: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    }).formatToParts(at);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/** DST-aware UTC offset label for a zone at a given instant, e.g. "GMT-04:00". */
export function timeZoneOffsetLabel(timeZone: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    }).formatToParts(at);
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return raw === "GMT" ? "GMT+00:00" : raw;
  } catch {
    return "";
  }
}

/**
 * Human label for a timezone option, e.g. "America/New_York (GMT-04:00 · EDT)".
 * Recomputed for `at` so the abbreviation/offset reflect DST correctly.
 */
export function formatTimeZoneLabel(timeZone: string, at: Date = new Date()): string {
  const name = timeZone.replace(/_/g, " ");
  const offset = timeZoneOffsetLabel(timeZone, at);
  const abbr = timeZoneAbbreviation(timeZone, at);
  const meta = [offset, abbr && !/^GMT/.test(abbr) ? abbr : ""].filter(Boolean).join(" · ");
  return meta ? `${name} (${meta})` : name;
}
