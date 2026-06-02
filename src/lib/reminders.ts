/**
 * Pure reminder-timing logic. Given a booking start and a set of reminder
 * rules ("send N minutes before the event"), compute the absolute send times,
 * dropping any that would already be in the past.
 */

export interface ReminderRule {
  id: number;
  /** minutes before the event start to send the reminder */
  offsetMinutes: number;
  action: "email_attendee" | "email_host" | "sms_attendee";
}

export interface PlannedReminder {
  workflowId: number;
  sendAt: Date;
  action: ReminderRule["action"];
}

/**
 * Compute concrete reminder send-times for a booking.
 *
 * @param start  booking start time
 * @param rules  reminder rules (e.g. 24h/1h/15m before)
 * @param now    reference clock (injectable for tests); reminders whose send
 *               time is already <= now are dropped.
 */
export function planReminders(
  start: Date,
  rules: ReminderRule[],
  now: Date = new Date(),
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const rule of rules) {
    if (rule.offsetMinutes < 0) continue;
    const sendAt = new Date(start.getTime() - rule.offsetMinutes * 60000);
    if (sendAt.getTime() <= now.getTime()) continue; // too late to send
    out.push({ workflowId: rule.id, sendAt, action: rule.action });
  }
  // Earliest reminders first.
  out.sort((a, b) => a.sendAt.getTime() - b.sendAt.getTime());
  return out;
}

/** Human label for common offsets, used in reminder UIs. */
export function offsetLabel(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440}d before`;
  if (minutes % 60 === 0) return `${minutes / 60}h before`;
  return `${minutes}m before`;
}
