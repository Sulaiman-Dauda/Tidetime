import { describe, expect, it } from "vitest";
import { isVideoLocationType, jitsiRoomUrl, locationLabel, resolveLocation } from "./locations";

describe("isVideoLocationType", () => {
  it("recognises every video provider including built-in Jitsi", () => {
    expect(isVideoLocationType("jitsi")).toBe(true);
    expect(isVideoLocationType("google_meet")).toBe(true);
    expect(isVideoLocationType("office365_video")).toBe(true);
    expect(isVideoLocationType("zoom")).toBe(true);
    expect(isVideoLocationType("daily_video")).toBe(true);
  });
  it("is false for non-video types", () => {
    expect(isVideoLocationType("in_person")).toBe(false);
    expect(isVideoLocationType("phone")).toBe(false);
    expect(isVideoLocationType("link")).toBe(false);
  });
});

describe("resolveLocation", () => {
  it("uses the custom link directly", () => {
    expect(resolveLocation({ type: "link", link: "https://x.example" })).toEqual({
      location: "Online",
      meetingUrl: "https://x.example",
    });
  });
  it("defers the URL for video providers (provisioned later)", () => {
    for (const type of ["google_meet", "office365_video", "zoom", "daily_video"] as const) {
      expect(resolveLocation({ type })).toEqual({ location: "Video call", meetingUrl: null });
    }
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
      meetingUrl: jitsiRoomUrl("abc123"),
    });
    expect(jitsiRoomUrl("abc123")).toContain("abc123");
    // Without a room id the link can't be minted yet.
    expect(resolveLocation({ type: "jitsi" }).meetingUrl).toBeNull();
  });
});

describe("locationLabel", () => {
  it("labels video providers by name", () => {
    expect(locationLabel({ type: "google_meet" })).toBe("Google Meet");
    expect(locationLabel({ type: "office365_video" })).toBe("Microsoft Teams");
    expect(locationLabel({ type: "zoom" })).toBe("Zoom");
  });
});
