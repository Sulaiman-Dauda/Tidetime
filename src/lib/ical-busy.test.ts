import { describe, expect, it } from "vitest";
import { parseIcsBusy, parseIcsDate, parseIcsDuration, unfoldIcs } from "./ical-busy";

const wrap = (lines: string) =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${lines}\r\nEND:VCALENDAR`;

describe("unfoldIcs", () => {
  it("joins folded continuation lines (RFC 5545 strips the leading space)", () => {
    expect(unfoldIcs("DESCRIPTION:hello\r\n world")).toEqual(["DESCRIPTION:helloworld"]);
  });
});

describe("parseIcsDate", () => {
  it("parses a UTC datetime", () => {
    expect(parseIcsDate("DTSTART:20260610T090000Z")?.toISOString()).toBe("2026-06-10T09:00:00.000Z");
  });
  it("parses a date-only value as UTC midnight", () => {
    expect(parseIcsDate("DTSTART;VALUE=DATE:20260610")?.toISOString()).toBe(
      "2026-06-10T00:00:00.000Z",
    );
  });
  it("parses a TZID datetime into UTC", () => {
    // 09:00 New York (EDT, -04:00) → 13:00 UTC
    expect(parseIcsDate("DTSTART;TZID=America/New_York:20260610T090000")?.toISOString()).toBe(
      "2026-06-10T13:00:00.000Z",
    );
  });
  it("returns null for malformed values", () => {
    expect(parseIcsDate("DTSTART:not-a-date")).toBeNull();
    expect(parseIcsDate("no-colon")).toBeNull();
  });
});

describe("parseIcsDuration", () => {
  it("parses hours and minutes", () => {
    expect(parseIcsDuration("PT1H30M")).toBe(90 * 60 * 1000);
  });
  it("parses days and weeks", () => {
    expect(parseIcsDuration("P1W")).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseIcsDuration("P1DT2H")).toBe((26 * 60 * 60) * 1000);
  });
});

describe("parseIcsBusy", () => {
  it("extracts a DTSTART/DTEND event", () => {
    const ics = wrap("BEGIN:VEVENT\r\nDTSTART:20260610T090000Z\r\nDTEND:20260610T093000Z\r\nEND:VEVENT");
    expect(parseIcsBusy(ics)).toEqual([
      { start: "2026-06-10T09:00:00.000Z", end: "2026-06-10T09:30:00.000Z" },
    ]);
  });

  it("derives end from DURATION when DTEND is absent", () => {
    const ics = wrap("BEGIN:VEVENT\r\nDTSTART:20260610T090000Z\r\nDURATION:PT1H\r\nEND:VEVENT");
    expect(parseIcsBusy(ics)).toEqual([
      { start: "2026-06-10T09:00:00.000Z", end: "2026-06-10T10:00:00.000Z" },
    ]);
  });

  it("skips TRANSPARENT (free) events", () => {
    const ics = wrap(
      "BEGIN:VEVENT\r\nDTSTART:20260610T090000Z\r\nDTEND:20260610T093000Z\r\nTRANSP:TRANSPARENT\r\nEND:VEVENT",
    );
    expect(parseIcsBusy(ics)).toEqual([]);
  });

  it("handles multiple events", () => {
    const ics = wrap(
      "BEGIN:VEVENT\r\nDTSTART:20260610T090000Z\r\nDTEND:20260610T093000Z\r\nEND:VEVENT\r\n" +
        "BEGIN:VEVENT\r\nDTSTART:20260610T110000Z\r\nDTEND:20260610T120000Z\r\nEND:VEVENT",
    );
    expect(parseIcsBusy(ics)).toHaveLength(2);
  });
});
