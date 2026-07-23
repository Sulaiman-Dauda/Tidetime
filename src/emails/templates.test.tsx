import { describe, expect, it, vi } from "vitest";
import { bookingConfirmedAttendee, passwordResetEmail, inviteEmail } from "@/server/emails";

// getAppUrl reads the custom domain from the DB; stub it so templates render
// without a database in unit tests.
vi.mock("@/server/app-url", () => ({
  getAppUrl: async () => process.env.APP_URL ?? "http://localhost:3100",
}));

describe("react-email rendering", () => {
  it("renders a booking confirmation to HTML with the meeting link", async () => {
    const a = await bookingConfirmedAttendee({
      title: "Intro call",
      start: new Date("2026-06-10T09:00:00Z"),
      end: new Date("2026-06-10T09:30:00Z"),
      timeZone: "America/New_York",
      hostName: "Jane",
      attendeeName: "Sam",
      location: "Online",
      meetingUrl: "https://meet.example/x",
      description: "Quick chat",
      manageUrl: "https://t/booking/abc",
      hour12: true,
    });
    expect(a.subject).toContain("Intro call");
    expect(a.html).toContain("<html");
    expect(a.html).toContain("meet.example");
    expect(a.html).toContain("Intro call");
  });

  it("labels host and attendee in the Who row and renders custom answers", async () => {
    const a = await bookingConfirmedAttendee({
      title: "New service",
      start: new Date("2026-07-23T13:00:00Z"),
      end: new Date("2026-07-23T13:30:00Z"),
      timeZone: "Europe/London",
      hostName: "Pablo",
      attendeeName: "Sulaiman",
      attendeeEmail: "attendee@example.com",
      location: "Phone call",
      meetingUrl: null,
      description: null,
      answers: [
        { label: "Phone Number", value: "076897656678" },
        { label: "Site Postcode", value: "co45tz" },
      ],
      manageUrl: "https://t/booking/abc",
      hour12: true,
    });
    expect(a.html).toContain("Host");
    expect(a.html).toContain("Pablo");
    expect(a.html).toContain("Sulaiman");
    expect(a.html).toContain("attendee@example.com");
    expect(a.html).toContain("Phone Number");
    expect(a.html).toContain("076897656678");
    expect(a.html).toContain("Site Postcode");
    expect(a.html).toContain("co45tz");
  });

  it("renders password-reset + invite emails", async () => {
    const reset = await passwordResetEmail("https://t/reset?token=x", 30);
    expect(reset.html).toContain("Reset your password");
    const invite = await inviteEmail({ teamName: "Acme", inviterName: "Jo", inviteUrl: "https://t/s?invite=x" });
    expect(invite.subject).toContain("Acme");
    expect(invite.html).toContain("Acme");
  });
});
