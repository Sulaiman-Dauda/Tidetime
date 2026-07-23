import { describe, expect, it } from "vitest";
import {
  createMicrosoftOAuthState,
  parseMicrosoftOAuthState,
  renderMicrosoftMime,
} from "./microsoft-email";
import { microsoftEmailConfigSchema } from "./settings";

describe("Microsoft email OAuth state", () => {
  it("round-trips an authenticated administrator id", () => {
    expect(parseMicrosoftOAuthState(createMicrosoftOAuthState(42))).toBe(42);
  });

  it("rejects tampering", () => {
    const state = createMicrosoftOAuthState(42);
    expect(parseMicrosoftOAuthState(`9${state.slice(1)}`)).toBeNull();
    expect(parseMicrosoftOAuthState(`${state.slice(0, -1)}x`)).toBeNull();
  });

  it("rejects expired and future-dated state", () => {
    expect(
      parseMicrosoftOAuthState(
        createMicrosoftOAuthState(42, Date.now() - 11 * 60 * 1000),
      ),
    ).toBeNull();
    expect(
      parseMicrosoftOAuthState(
        createMicrosoftOAuthState(42, Date.now() + 2 * 60 * 1000),
      ),
    ).toBeNull();
  });

  it("rejects malformed user ids", () => {
    expect(parseMicrosoftOAuthState(createMicrosoftOAuthState(0))).toBeNull();
    expect(parseMicrosoftOAuthState("not-a-state")).toBeNull();
  });
});

describe("Microsoft Graph MIME rendering", () => {
  it("preserves HTML, text, and iCalendar invitations", async () => {
    const message = await renderMicrosoftMime(
      {
        to: "customer@example.com",
        subject: "Booking confirmed",
        html: "<p>Your booking is confirmed.</p>",
        text: "Your booking is confirmed.",
        icalEvent: {
          method: "REQUEST",
          content: [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "METHOD:REQUEST",
            "BEGIN:VEVENT",
            "UID:test@example.com",
            "END:VEVENT",
            "END:VCALENDAR",
          ].join("\r\n"),
        },
      },
      '"Tidetime" <bookings@example.com>',
    );
    const mime = message.toString("utf8");
    expect(mime).toContain("Subject: Booking confirmed");
    expect(mime).toContain("customer@example.com");
    expect(mime).toContain("text/calendar");
    expect(mime).toContain("method=REQUEST");
    expect(mime).toContain("BEGIN:VCALENDAR");
  });
});

describe("Microsoft email configuration", () => {
  const valid = {
    tenantId: "11111111-1111-4111-8111-111111111111",
    clientId: "22222222-2222-4222-8222-222222222222",
    clientSecret: "secret-value",
    fromName: "Tidetime",
  };

  it("accepts single-tenant Entra application identifiers", () => {
    expect(microsoftEmailConfigSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects aliases and malformed identifiers", () => {
    expect(
      microsoftEmailConfigSchema.safeParse({ ...valid, tenantId: "organizations" }).success,
    ).toBe(false);
    expect(
      microsoftEmailConfigSchema.safeParse({ ...valid, clientId: "not-a-client-id" }).success,
    ).toBe(false);
  });
});
