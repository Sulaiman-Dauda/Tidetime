import "server-only";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import {
  workflows,
  scheduledReminders,
  bookings,
  attendees,
  users,
} from "@/db/schema";
import { planReminders, type ReminderRule } from "@/lib/reminders";
import { t } from "@/lib/i18n";
import { sendMail } from "./mailer";
import { logBookingActivity } from "./activity";
import { formatRange } from "@/lib/format";
import { env } from "@/lib/env";

/**
 * Materialise reminder jobs for a freshly-created booking from the host's
 * "before_event" reminder workflows. Idempotent enough for at-least-once use:
 * callers should only invoke once per booking creation.
 */
export async function scheduleRemindersForBooking(
  bookingId: number,
  hostUserId: number,
  eventTypeId: number,
  start: Date,
): Promise<void> {
  const rows = await db
    .select()
    .from(workflows)
    .where(
      and(
        eq(workflows.userId, hostUserId),
        eq(workflows.trigger, "before_event"),
        eq(workflows.active, true),
        or(isNull(workflows.eventTypeId), eq(workflows.eventTypeId, eventTypeId)),
      ),
    );
  if (rows.length === 0) return;

  const rules: ReminderRule[] = rows.map((w) => ({
    id: w.id,
    offsetMinutes: w.offsetMinutes,
    action: w.action,
  }));

  const planned = planReminders(start, rules);
  if (planned.length === 0) return;

  await db.insert(scheduledReminders).values(
    planned.map((p) => ({
      bookingId,
      workflowId: p.workflowId,
      sendAt: p.sendAt,
      action: p.action,
    })),
  );
}

/** Remove pending (unsent) reminders for a booking — used on cancel/reschedule. */
export async function cancelRemindersForBooking(bookingId: number): Promise<void> {
  await db
    .delete(scheduledReminders)
    .where(and(eq(scheduledReminders.bookingId, bookingId), isNull(scheduledReminders.sentAt)));
}

export interface ReminderRunResult {
  processed: number;
  sent: number;
  failed: number;
}

/**
 * Process all due reminder jobs. Designed to be invoked by a cron/queue worker
 * (see scripts/run-reminders.ts). Marks each job sent regardless of delivery
 * outcome to avoid duplicate sends; failures are counted for observability.
 */
export async function processDueReminders(now: Date = new Date()): Promise<ReminderRunResult> {
  const due = await db
    .select({
      reminder: scheduledReminders,
      booking: bookings,
    })
    .from(scheduledReminders)
    .innerJoin(bookings, eq(scheduledReminders.bookingId, bookings.id))
    .where(and(isNull(scheduledReminders.sentAt), lte(scheduledReminders.sendAt, now)))
    .limit(500);

  let sent = 0;
  let failed = 0;

  for (const { reminder, booking } of due) {
    // Skip reminders for cancelled/rejected bookings, but mark them handled.
    if (booking.status === "cancelled" || booking.status === "rejected") {
      await db
        .update(scheduledReminders)
        .set({ sentAt: now })
        .where(eq(scheduledReminders.id, reminder.id));
      continue;
    }

    try {
      const recipients = await resolveRecipients(reminder.action, booking.id, booking.userId);
      const when = formatRange(booking.startTime, booking.endTime, recipients.timeZone, true);
      const html = reminderHtml(booking.title, when, recipients.timeZone, `${env.appUrl}/booking/${booking.uid}`);
      const subject = `${t(recipients.locale, "email.reminderSubject")} — ${booking.title}`;
      for (const to of recipients.emails) {
        await sendMail({ to, subject, html });
      }
      await logBookingActivity(booking.id, "reminder_sent", {
        message: `Reminder email sent to ${recipients.emails.length} recipient${
          recipients.emails.length === 1 ? "" : "s"
        }`,
      });
      sent++;
    } catch {
      failed++;
    } finally {
      await db
        .update(scheduledReminders)
        .set({ sentAt: new Date() })
        .where(eq(scheduledReminders.id, reminder.id));
    }
  }

  return { processed: due.length, sent, failed };
}

async function resolveRecipients(
  action: "email_attendee" | "email_host",
  bookingId: number,
  hostUserId: number | null,
): Promise<{ emails: string[]; timeZone: string; locale: string }> {
  if (action === "email_host" && hostUserId) {
    const [u] = await db
      .select({ email: users.email, timeZone: users.timeZone, locale: users.locale })
      .from(users)
      .where(eq(users.id, hostUserId))
      .limit(1);
    return { emails: u ? [u.email] : [], timeZone: u?.timeZone ?? "UTC", locale: u?.locale ?? "en" };
  }
  // default: email the attendees
  const ats = await db
    .select({ email: attendees.email, timeZone: attendees.timeZone, locale: attendees.locale })
    .from(attendees)
    .where(eq(attendees.bookingId, bookingId));
  return {
    emails: ats.map((a) => a.email),
    timeZone: ats[0]?.timeZone ?? "UTC",
    locale: ats[0]?.locale ?? "en",
  };
}

function reminderHtml(title: string, when: string, tz: string, manageUrl: string): string {
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;padding:24px;">
<h2 style="margin:0 0 8px;">Reminder</h2>
<p style="margin:0 0 12px;color:#475569;">This is a reminder for your upcoming booking.</p>
<p style="margin:0 0 4px;"><strong>${title}</strong></p>
<p style="margin:0 0 12px;color:#475569;">${when} (${tz.replace(/_/g, " ")})</p>
<a href="${manageUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;">Manage booking</a>
</body></html>`;
}
