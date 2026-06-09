import { describe, expect, it } from "vitest";
import { graphDateTime, isGraphEventBusy, parseGraphDate } from "./ms-graph";

describe("graphDateTime", () => {
  it("emits a wall-clock UTC datetime without the Z", () => {
    expect(graphDateTime(new Date("2026-06-10T09:00:00Z"))).toEqual({
      dateTime: "2026-06-10T09:00:00.000",
      timeZone: "UTC",
    });
  });
});

describe("parseGraphDate", () => {
  it("adds a Z when Graph omits the zone designator", () => {
    expect(parseGraphDate({ dateTime: "2026-06-10T09:00:00.0000000" })).toBe(
      "2026-06-10T09:00:00.000Z",
    );
  });
  it("respects an explicit Z", () => {
    expect(parseGraphDate({ dateTime: "2026-06-10T09:00:00Z" })).toBe("2026-06-10T09:00:00.000Z");
  });
  it("returns null for missing/invalid input", () => {
    expect(parseGraphDate(undefined)).toBeNull();
    expect(parseGraphDate({ dateTime: "nope" })).toBeNull();
  });
});

describe("isGraphEventBusy", () => {
  it("counts busy/oof/tentative as busy", () => {
    expect(isGraphEventBusy({ showAs: "busy" })).toBe(true);
    expect(isGraphEventBusy({ showAs: "oof" })).toBe(true);
    expect(isGraphEventBusy({ showAs: "tentative" })).toBe(true);
  });
  it("treats free as not busy", () => {
    expect(isGraphEventBusy({ showAs: "free" })).toBe(false);
  });
  it("excludes cancelled events", () => {
    expect(isGraphEventBusy({ showAs: "busy", isCancelled: true })).toBe(false);
  });
  it("defaults to busy when showAs is absent", () => {
    expect(isGraphEventBusy({})).toBe(true);
  });
});
