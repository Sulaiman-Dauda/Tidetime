import { render } from "@react-email/render";
import { formatRange } from "@/lib/format";
import {
  BookingEmail,
  InviteEmail,
  PasswordResetEmail,
  type BookingEmailProps,
} from "@/emails/templates";

/**
 * Transactional email builders. Each returns `{ subject, html }`; the HTML is
 * produced by rendering a React Email component (see `@/emails/templates`).
 * Builders are async because `@react-email/render` returns a Promise.
 */

interface EmailBookingView {
  title: string;
  start: Date;
  end: Date;
  timeZone: string;
  hostName: string;
  attendeeName: string;
  attendeeEmail?: string | null;
  location: string;
  meetingUrl: string | null;
  description?: string | null;
  /** answers to the service's custom booking questions, in form order */
  answers?: { label: string; value: string }[];
  manageUrl: string;
  hour12?: boolean;
  /** signed Accept / Decline / Tentative links for attendee RSVP round-tripping */
  rsvp?: { accept: string; decline: string; tentative: string } | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

function toBookingProps(
  v: EmailBookingView,
  heading: string,
  intro: string,
  accent?: string,
): BookingEmailProps {
  return {
    heading,
    intro,
    accent,
    title: v.title,
    when: formatRange(v.start, v.end, v.timeZone, v.hour12 ?? true),
    timeZone: v.timeZone,
    hostName: v.hostName,
    attendeeName: v.attendeeName,
    attendeeEmail: v.attendeeEmail,
    location: v.location,
    meetingUrl: v.meetingUrl,
    description: v.description,
    answers: v.answers,
    manageUrl: v.manageUrl,
    rsvp: v.rsvp ?? null,
  };
}

export async function bookingConfirmedAttendee(v: EmailBookingView): Promise<RenderedEmail> {
  return {
    subject: `Confirmed: ${v.title} with ${v.hostName}`,
    html: await render(
      BookingEmail(
        toBookingProps(v, "Your booking is confirmed", `You're booked with ${v.hostName}. A calendar invite is attached.`),
      ),
    ),
  };
}

export async function bookingConfirmedHost(v: EmailBookingView): Promise<RenderedEmail> {
  return {
    subject: `New booking: ${v.title} with ${v.attendeeName}`,
    html: await render(
      BookingEmail(toBookingProps(v, "New booking", `${v.attendeeName} booked time with you.`)),
    ),
  };
}

export async function bookingPendingAttendee(v: EmailBookingView): Promise<RenderedEmail> {
  return {
    subject: `Requested: ${v.title} with ${v.hostName}`,
    html: await render(
      BookingEmail(
        toBookingProps(
          v,
          "Booking requested",
          `Your request was sent to ${v.hostName}. You'll get a confirmation once it's approved.`,
          "#b45309",
        ),
      ),
    ),
  };
}

export async function bookingCancelledAttendee(
  v: EmailBookingView,
  reason?: string,
): Promise<RenderedEmail> {
  return {
    subject: `Cancelled: ${v.title}`,
    html: await render(
      BookingEmail(
        toBookingProps(
          v,
          "Booking cancelled",
          reason ? `Reason: ${reason}` : "This booking has been cancelled.",
          "#b91c1c",
        ),
      ),
    ),
  };
}

export async function bookingRescheduledAttendee(v: EmailBookingView): Promise<RenderedEmail> {
  return {
    subject: `Rescheduled: ${v.title}`,
    html: await render(
      BookingEmail(
        toBookingProps(v, "Booking rescheduled", "Your booking has a new time. An updated invite is attached."),
      ),
    ),
  };
}

/** Password-reset email with a one-time link. */
export async function passwordResetEmail(
  resetUrl: string,
  ttlMinutes: number,
): Promise<RenderedEmail> {
  return {
    subject: "Reset your password",
    html: await render(PasswordResetEmail({ resetUrl, ttlMinutes })),
  };
}

export async function inviteEmail(params: {
  teamName: string;
  inviterName: string;
  inviteUrl: string;
}): Promise<RenderedEmail> {
  return {
    subject: `${params.inviterName} invited you to ${params.teamName}`,
    html: await render(InviteEmail(params)),
  };
}

export type { EmailBookingView };
