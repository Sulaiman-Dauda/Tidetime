import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  meetingPolls,
  meetingPollOptions,
  meetingPollVotes,
  bookings,
  attendees,
  users,
} from "@/db/schema";
import { shortId } from "@/lib/crypto";
import { env } from "@/lib/env";
import { isPollChoice, rankOptions, type PollChoice, type PollVisibility } from "@/lib/polls";
import { runAcceptedBookingEffects } from "./booking-effects";
import { sendMail } from "./mailer";
import { logBookingActivity } from "./activity";

/* -------------------------------------------------------------------------- */
/*  Create / list / read                                                       */
/* -------------------------------------------------------------------------- */

export interface CreatePollInput {
  title: string;
  description?: string | null;
  location?: string | null;
  durationMinutes: number;
  timeZone: string;
  options: { start: Date; end: Date }[];
  /** result visibility for voters; defaults to "full" */
  visibility?: PollVisibility;
  /** mask participant names from other voters */
  hideParticipants?: boolean;
}

export async function createPoll(userId: number, input: CreatePollInput): Promise<string> {
  const token = shortId(12);
  await db.transaction(async (tx) => {
    const [poll] = await tx
      .insert(meetingPolls)
      .values({
        userId,
        token,
        title: input.title,
        description: input.description ?? null,
        location: input.location ?? null,
        durationMinutes: input.durationMinutes,
        timeZone: input.timeZone,
        visibility: input.visibility ?? "full",
        hideParticipants: input.hideParticipants ?? false,
      })
      .returning({ id: meetingPolls.id });
    if (input.options.length > 0) {
      await tx.insert(meetingPollOptions).values(
        input.options.map((o) => ({ pollId: poll.id, startTime: o.start, endTime: o.end })),
      );
    }
  });
  return token;
}

export async function listPolls(userId: number) {
  return db
    .select({
      id: meetingPolls.id,
      token: meetingPolls.token,
      title: meetingPolls.title,
      status: meetingPolls.status,
      createdAt: meetingPolls.createdAt,
    })
    .from(meetingPolls)
    .where(eq(meetingPolls.userId, userId))
    .orderBy(desc(meetingPolls.createdAt));
}

async function loadOptions(pollId: number) {
  return db
    .select()
    .from(meetingPollOptions)
    .where(eq(meetingPollOptions.pollId, pollId))
    .orderBy(asc(meetingPollOptions.startTime));
}

async function loadVotes(pollId: number) {
  return db.select().from(meetingPollVotes).where(eq(meetingPollVotes.pollId, pollId));
}

export async function getPollForOwner(id: number, userId: number) {
  const [poll] = await db
    .select()
    .from(meetingPolls)
    .where(and(eq(meetingPolls.id, id), eq(meetingPolls.userId, userId)))
    .limit(1);
  if (!poll) return null;
  const [options, votes] = await Promise.all([loadOptions(poll.id), loadVotes(poll.id)]);
  return { poll, options, votes };
}

export async function getPublicPoll(token: string) {
  const [poll] = await db
    .select()
    .from(meetingPolls)
    .where(eq(meetingPolls.token, token))
    .limit(1);
  if (!poll) return null;
  const [options, votes] = await Promise.all([loadOptions(poll.id), loadVotes(poll.id)]);
  return { poll, options, votes };
}

/* -------------------------------------------------------------------------- */
/*  Voting                                                                      */
/* -------------------------------------------------------------------------- */

export interface SubmitVotesInput {
  voterName: string;
  voterEmail: string;
  choices: { optionId: number; choice: PollChoice }[];
}

export async function submitPollVotes(
  token: string,
  input: SubmitVotesInput,
): Promise<{ ok: boolean; error?: string }> {
  const [poll] = await db
    .select({ id: meetingPolls.id, status: meetingPolls.status })
    .from(meetingPolls)
    .where(eq(meetingPolls.token, token))
    .limit(1);
  if (!poll) return { ok: false, error: "Poll not found" };
  if (poll.status !== "open") return { ok: false, error: "This poll is closed." };

  const optionRows = await db
    .select({ id: meetingPollOptions.id })
    .from(meetingPollOptions)
    .where(eq(meetingPollOptions.pollId, poll.id));
  const validIds = new Set(optionRows.map((o) => o.id));

  const email = input.voterEmail.trim().toLowerCase();
  const clean = input.choices.filter((c) => validIds.has(c.optionId) && isPollChoice(c.choice));
  if (clean.length === 0) return { ok: false, error: "Please vote on at least one option." };

  await db.transaction(async (tx) => {
    // Re-voting replaces the participant's previous votes for this poll.
    await tx
      .delete(meetingPollVotes)
      .where(and(eq(meetingPollVotes.pollId, poll.id), eq(meetingPollVotes.voterEmail, email)));
    await tx.insert(meetingPollVotes).values(
      clean.map((c) => ({
        pollId: poll.id,
        optionId: c.optionId,
        voterName: input.voterName.trim().slice(0, 128),
        voterEmail: email,
        choice: c.choice,
      })),
    );
  });
  return { ok: true };
}

/**
 * Look up a returning voter's existing response so the public form can prefill
 * it (the lean version of Rallly's participant edit link — keyed by the email
 * the voter already owns, no extra token/account). Returns null for an open
 * poll the email hasn't voted on yet.
 */
export async function getVoterVotes(
  token: string,
  voterEmail: string,
): Promise<{ voterName: string; choices: { optionId: number; choice: PollChoice }[] } | null> {
  const email = voterEmail.trim().toLowerCase();
  if (!email) return null;

  const [poll] = await db
    .select({ id: meetingPolls.id })
    .from(meetingPolls)
    .where(eq(meetingPolls.token, token))
    .limit(1);
  if (!poll) return null;

  const rows = await db
    .select({
      optionId: meetingPollVotes.optionId,
      choice: meetingPollVotes.choice,
      voterName: meetingPollVotes.voterName,
    })
    .from(meetingPollVotes)
    .where(and(eq(meetingPollVotes.pollId, poll.id), eq(meetingPollVotes.voterEmail, email)));
  if (rows.length === 0) return null;

  return {
    voterName: rows[0].voterName,
    choices: rows
      .filter((r): r is typeof r & { choice: PollChoice } => isPollChoice(r.choice))
      .map((r) => ({ optionId: r.optionId, choice: r.choice })),
  };
}

/* -------------------------------------------------------------------------- */
/*  Finalize / cancel                                                           */
/* -------------------------------------------------------------------------- */

export async function cancelPoll(id: number, userId: number): Promise<void> {
  await db
    .update(meetingPolls)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(meetingPolls.id, id), eq(meetingPolls.userId, userId)));
}

/**
 * Finalize a poll: book the chosen option for every participant who voted yes or
 * if-need-be on it, then notify everyone. Returns the new booking uid.
 */
export async function finalizePoll(
  id: number,
  userId: number,
  optionId: number,
): Promise<{ ok: boolean; error?: string; uid?: string }> {
  const data = await getPollForOwner(id, userId);
  if (!data) return { ok: false, error: "Poll not found" };
  if (data.poll.status === "finalized") return { ok: false, error: "Poll already finalized." };

  const option = data.options.find((o) => o.id === optionId);
  if (!option) return { ok: false, error: "Unknown option." };

  // Attendees = distinct voters who said yes / if_need_be on the chosen option.
  const accepted = data.votes.filter(
    (v) => v.optionId === optionId && (v.choice === "yes" || v.choice === "if_need_be"),
  );
  const byEmail = new Map<string, { name: string; email: string }>();
  for (const v of accepted) {
    if (!byEmail.has(v.voterEmail)) byEmail.set(v.voterEmail, { name: v.voterName, email: v.voterEmail });
  }
  const participants = [...byEmail.values()];

  const [host] = await db
    .select({ name: users.name, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const uid = shortId();
  const [booking] = await db
    .insert(bookings)
    .values({
      uid,
      userId,
      title: data.poll.title,
      description: data.poll.description ?? null,
      startTime: option.startTime,
      endTime: option.endTime,
      status: "accepted",
      location: data.poll.location ?? "Online",
    })
    .returning({ id: bookings.id });

  if (participants.length > 0) {
    await db.insert(attendees).values(
      participants.map((p, i) => ({
        bookingId: booking.id,
        email: p.email,
        name: p.name,
        timeZone: data.poll.timeZone,
        isPrimary: i === 0,
      })),
    );
  }

  await db
    .update(meetingPolls)
    .set({
      status: "finalized",
      finalizedOptionId: optionId,
      finalizedBookingUid: uid,
      updatedAt: new Date(),
    })
    .where(eq(meetingPolls.id, id));

  await logBookingActivity(booking.id, "created", {
    actor: host?.username ?? "host",
    message: "Created from a finalized meeting poll",
  });

  // Rich host/calendar/primary-attendee handling + reminders.
  await runAcceptedBookingEffects(booking.id).catch(() => undefined);

  // Notify the non-primary participants of the confirmed time.
  const when = option.startTime.toLocaleString("en-US", {
    timeZone: data.poll.timeZone,
    dateStyle: "full",
    timeStyle: "short",
  });
  const manageUrl = `${env.appUrl}/booking/${uid}`;
  await Promise.allSettled(
    participants.slice(1).map((p) =>
      sendMail({
        to: p.email,
        subject: `Confirmed: ${data.poll.title}`,
        html:
          `<p>Hi ${escapeHtml(p.name)},</p>` +
          `<p>The time for <strong>${escapeHtml(data.poll.title)}</strong> has been confirmed:</p>` +
          `<p><strong>${escapeHtml(when)}</strong> (${escapeHtml(data.poll.timeZone)})</p>` +
          (data.poll.location ? `<p>Location: ${escapeHtml(data.poll.location)}</p>` : "") +
          `<p><a href="${manageUrl}">View booking</a></p>`,
      }),
    ),
  );

  return { ok: true, uid };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Ranking helper re-exported for pages. */
export { rankOptions };
