/** A curated, deduplicated list of common IANA timezones for selects. */
export function listTimeZones(): string[] {
  // Use the runtime-supported set when available (Node 22 / modern browsers).
  const sv = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
  if (typeof sv === "function") {
    try {
      const zones = sv("timeZone");
      // The runtime list omits plain "UTC", but users (and the seed) store it —
      // a select whose value is missing from its options renders blank.
      return zones.includes("UTC") ? zones : ["UTC", ...zones];
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
