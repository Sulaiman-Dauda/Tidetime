import { describe, expect, it } from "vitest";
import {
  bookingFieldsSchema,
  eventLocationsSchema,
  httpUrlSchema,
  timeZoneSchema,
} from "@/lib/schemas";

describe("timeZoneSchema", () => {
  it("accepts valid IANA timezones", () => {
    expect(timeZoneSchema.parse("Europe/London")).toBe("Europe/London");
  });

  it("rejects invalid timezones", () => {
    expect(() => timeZoneSchema.parse("Mars/Olympus")).toThrow(/valid IANA timezone/i);
  });
});

describe("httpUrlSchema", () => {
  it("accepts http and https URLs", () => {
    expect(httpUrlSchema.parse("https://example.com/path")).toBe("https://example.com/path");
    expect(httpUrlSchema.parse("http://localhost:3100/webhook")).toBe("http://localhost:3100/webhook");
  });

  it("rejects non-http URLs", () => {
    expect(() => httpUrlSchema.parse("ftp://example.com")).toThrow(/http/i);
  });
});

describe("eventLocationsSchema", () => {
  it("requires a URL for custom links", () => {
    expect(() =>
      eventLocationsSchema.parse([{ type: "link", link: "not-a-url" }]),
    ).toThrow(/valid url/i);
  });
});

describe("bookingFieldsSchema", () => {
  it("rejects duplicate field names", () => {
    expect(() =>
      bookingFieldsSchema.parse([
        { name: "company", label: "Company", type: "text", required: false },
        { name: "company", label: "Company size", type: "text", required: false },
      ]),
    ).toThrow(/duplicate field name/i);
  });

  it("requires options for select-like fields", () => {
    expect(() =>
      bookingFieldsSchema.parse([
        { name: "team_size", label: "Team size", type: "select", required: false },
      ]),
    ).toThrow(/requires at least one option/i);
  });
});
