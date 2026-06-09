import { describe, expect, it } from "vitest";
import { bookingConfirmedAttendee, passwordResetEmail, inviteEmail } from "@/server/emails";

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

  it("renders password-reset + invite emails", async () => {
    const reset = await passwordResetEmail("https://t/reset?token=x", 30);
    expect(reset.html).toContain("Reset your password");
    const invite = await inviteEmail({ teamName: "Acme", inviterName: "Jo", inviteUrl: "https://t/s?invite=x" });
    expect(invite.subject).toContain("Acme");
    expect(invite.html).toContain("Acme");
  });
});
