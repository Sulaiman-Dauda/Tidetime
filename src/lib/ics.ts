import { createHash } from "node:crypto";

export interface IcsEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  organizer?: { name: string; email: string };
  attendees?: { name: string; email: string }[];
  url?: string;
  /** "CONFIRMED" | "CANCELLED" | "TENTATIVE" */
  status?: string;
  sequence?: number;
}

function fmt(date: Date): string {
  // UTC basic format: YYYYMMDDTHHMMSSZ
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Control characters (except those normalised below) are stripped so they can't
// break out of an iCalendar value or inject extra lines.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function escape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n") // normalise + escape all newlines (prevents CRLF injection)
    .replace(CONTROL_CHARS, "");
}

/** Fold long lines to 75 octets per RFC 5545. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let s = line;
  parts.push(s.slice(0, 75));
  s = s.slice(75);
  while (s.length > 74) {
    parts.push(" " + s.slice(0, 74));
    s = s.slice(74);
  }
  if (s.length) parts.push(" " + s);
  return parts.join("\r\n");
}

/** Generate a single-event iCalendar (RFC 5545) string. */
export function generateIcs(ev: IcsEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tidetime//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${ev.status === "CANCELLED" ? "CANCEL" : "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(ev.start)}`,
    `DTEND:${fmt(ev.end)}`,
    `SEQUENCE:${ev.sequence ?? 0}`,
    `STATUS:${ev.status ?? "CONFIRMED"}`,
    `SUMMARY:${escape(ev.summary)}`,
  ];
  if (ev.description) lines.push(`DESCRIPTION:${escape(ev.description)}`);
  if (ev.location) lines.push(`LOCATION:${escape(ev.location)}`);
  if (ev.url) lines.push(`URL:${escape(ev.url)}`);
  if (ev.organizer) lines.push(`ORGANIZER;CN=${escape(ev.organizer.name)}:mailto:${ev.organizer.email}`);
  for (const a of ev.attendees ?? []) {
    lines.push(
      `ATTENDEE;CN=${escape(a.name)};RSVP=TRUE;PARTSTAT=NEEDS-ACTION:mailto:${a.email}`,
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(fold).join("\r\n");
}

/** Stable UID for a booking so calendar updates replace the same event. */
export function bookingIcalUid(bookingUid: string): string {
  return `${createHash("sha1").update(bookingUid).digest("hex").slice(0, 24)}@tidetime`;
}
