import { formatRange } from "@/lib/format";
import { env } from "@/lib/env";

interface EmailBookingView {
  title: string;
  start: Date;
  end: Date;
  timeZone: string;
  hostName: string;
  attendeeName: string;
  location: string;
  meetingUrl: string | null;
  description?: string | null;
  manageUrl: string;
  hour12?: boolean;
}

const wrap = (inner: string) => `<!doctype html><html><body style="margin:0;background:#f6f7f9;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
<tr><td style="padding:24px 28px;border-bottom:1px solid #eef2f6;">
<span style="font-weight:600;font-size:16px;letter-spacing:-0.01em;">Tidetime</span>
</td></tr>
${inner}
<tr><td style="padding:18px 28px;border-top:1px solid #eef2f6;color:#94a3b8;font-size:12px;">
Sent by Tidetime · <a href="${env.appUrl}" style="color:#94a3b8;">${env.appUrl.replace(/^https?:\/\//, "")}</a>
</td></tr>
</table></td></tr></table></body></html>`;

const detailRow = (label: string, value: string) => `<tr>
<td style="padding:6px 0;color:#64748b;font-size:13px;width:120px;vertical-align:top;">${label}</td>
<td style="padding:6px 0;font-size:14px;font-weight:500;">${value}</td></tr>`;

function body(v: EmailBookingView, heading: string, intro: string, accent = "#0f172a") {
  const when = formatRange(v.start, v.end, v.timeZone, v.hour12 ?? true);
  return wrap(`<tr><td style="padding:28px;">
<h1 style="margin:0 0 6px;font-size:20px;letter-spacing:-0.02em;color:${accent};">${heading}</h1>
<p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.5;">${intro}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef2f6;border-radius:10px;padding:8px 16px;">
${detailRow("What", v.title)}
${detailRow("When", `${when} <span style="color:#94a3b8;font-weight:400;">(${v.timeZone.replace(/_/g, " ")})</span>`)}
${detailRow("Who", `${v.hostName} &amp; ${v.attendeeName}`)}
${detailRow("Where", v.meetingUrl ? `<a href="${v.meetingUrl}" style="color:#2563eb;">${v.location || "Join meeting"}</a>` : v.location)}
${v.description ? detailRow("Notes", v.description) : ""}
</table>
<div style="margin-top:22px;">
<a href="${v.manageUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 18px;border-radius:8px;">Reschedule or cancel</a>
</div>
</td></tr>`);
}

export function bookingConfirmedAttendee(v: EmailBookingView) {
  return {
    subject: `Confirmed: ${v.title} with ${v.hostName}`,
    html: body(v, "Your booking is confirmed", `You're booked with ${v.hostName}. A calendar invite is attached.`),
  };
}

export function bookingConfirmedHost(v: EmailBookingView) {
  return {
    subject: `New booking: ${v.title} with ${v.attendeeName}`,
    html: body(v, "New booking", `${v.attendeeName} booked time with you.`),
  };
}

export function bookingPendingAttendee(v: EmailBookingView) {
  return {
    subject: `Requested: ${v.title} with ${v.hostName}`,
    html: body(
      v,
      "Booking requested",
      `Your request was sent to ${v.hostName}. You'll get a confirmation once it's approved.`,
      "#b45309",
    ),
  };
}

export function bookingCancelledAttendee(v: EmailBookingView, reason?: string) {
  return {
    subject: `Cancelled: ${v.title}`,
    html: body(v, "Booking cancelled", reason ? `Reason: ${reason}` : "This booking has been cancelled.", "#b91c1c"),
  };
}

export function bookingRescheduledAttendee(v: EmailBookingView) {
  return {
    subject: `Rescheduled: ${v.title}`,
    html: body(v, "Booking rescheduled", "Your booking has a new time. An updated invite is attached."),
  };
}

/** Confirmation for a recurring series — lists every occurrence. */
export function bookingSeriesConfirmedAttendee(
  v: EmailBookingView,
  dates: Date[],
  timeZone: string,
  hour12: boolean,
  status: "accepted" | "pending",
) {
  const durationMs = v.end.getTime() - v.start.getTime();
  const items = dates
    .map((d) => {
      const when = formatRange(d, new Date(d.getTime() + durationMs), timeZone, hour12);
      return `<li style="padding:4px 0;font-size:14px;">${when}</li>`;
    })
    .join("");
  const heading = status === "pending" ? "Recurring booking requested" : "Recurring booking confirmed";
  const intro =
    status === "pending"
      ? `Your recurring request with ${v.hostName} was sent. You'll be confirmed once approved. ${dates.length} occurrences:`
      : `You're booked with ${v.hostName} for ${dates.length} occurrences:`;
  const inner = `<tr><td style="padding:28px;">
<h1 style="margin:0 0 6px;font-size:20px;letter-spacing:-0.02em;">${heading}</h1>
<p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.5;">${intro}</p>
<ul style="margin:0 0 20px;padding-left:18px;color:#0f172a;">${items}</ul>
<a href="${v.manageUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 18px;border-radius:8px;">Manage bookings</a>
</td></tr>`;
  return {
    subject: `${status === "pending" ? "Requested" : "Confirmed"}: ${v.title} (×${dates.length})`,
    html: wrap(inner),
  };
}

/** Password-reset email with a one-time link. */
export function passwordResetEmail(resetUrl: string, ttlMinutes: number) {
  const inner = `<tr><td style="padding:28px;">
<h1 style="margin:0 0 6px;font-size:20px;letter-spacing:-0.02em;">Reset your password</h1>
<p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.5;">We received a request to reset your Tidetime password. This link expires in ${ttlMinutes} minutes. If you didn't request this, you can safely ignore this email.</p>
<a href="${resetUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 18px;border-radius:8px;">Choose a new password</a>
<p style="margin:18px 0 0;color:#94a3b8;font-size:12px;word-break:break-all;">Or paste this URL into your browser:<br>${resetUrl}</p>
</td></tr>`;
  return { subject: "Reset your Tidetime password", html: wrap(inner) };
}

export type { EmailBookingView };
