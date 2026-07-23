import { describe, expect, it } from "vitest";
import { locationLabel, resolveLocation } from "./locations";

describe("resolveLocation", () => {
  it("uses the custom link directly", () => {
    expect(resolveLocation({ type: "link", link: "https://x.example" })).toEqual({
      location: "Online",
      meetingUrl: "https://x.example",
    });
  });
  it("defers the Google Meet URL until calendar provisioning", () => {
    expect(resolveLocation({ type: "google_meet" })).toEqual({ location: "Video call", meetingUrl: null });
  });
  it("uses the attendee phone for attendee_phone", () => {
    expect(resolveLocation({ type: "attendee_phone" }, "+123")).toEqual({
      location: "Call: +123",
      meetingUrl: null,
    });
  });
  it("mints a built-in Jitsi room from the booking id, no provider needed", () => {
    expect(resolveLocation({ type: "jitsi" }, undefined, "abc123")).toEqual({
      location: "Video call",
      meetingUrl: "https://meet.jit.si/Tidetime-abc123",
    });
    // Without a room id the link can't be minted yet.
    expect(resolveLocation({ type: "jitsi" }).meetingUrl).toBeNull();
  });
});

describe("locationLabel", () => {
  it("labels Google Meet by name", () => {
    expect(locationLabel({ type: "google_meet" })).toBe("Google Meet");
  });
});
