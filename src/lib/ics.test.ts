import { describe, expect, it } from "vitest";
import { generateIcs } from "./ics";

const base = {
  uid: "abc123",
  start: new Date("2026-01-01T10:00:00Z"),
  end: new Date("2026-01-01T11:00:00Z"),
  summary: "Intro call",
};

describe("generateIcs", () => {
  it("produces a well-formed calendar", () => {
    const ics = generateIcs(base);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("SUMMARY:Intro call");
  });

  it("neutralises CRLF injection in user-controlled fields", () => {
    const ics = generateIcs({
      ...base,
      summary: "Hello\r\nX-EVIL:injected",
      description: "line1\nline2",
    });
    // No property line may be forged from the injected payload.
    const lines = ics.split("\r\n");
    expect(lines.some((l) => l.startsWith("X-EVIL"))).toBe(false);
    // The newline must be escaped inline, not emitted as a real break.
    expect(ics).toContain("SUMMARY:Hello\\nX-EVIL:injected");
  });
});
