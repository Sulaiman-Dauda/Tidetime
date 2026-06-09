"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { submitPollVotes, getVoterVotes } from "@/server/polls";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import type { PollChoice } from "@/lib/polls";

const schema = z.object({
  token: z.string().min(1),
  voterName: z.string().trim().min(1, "Name is required").max(128),
  voterEmail: z.string().email("Enter a valid email"),
  choices: z
    .array(
      z.object({
        optionId: z.number().int().positive(),
        choice: z.enum(["yes", "no", "if_need_be"]),
      }),
    )
    .min(1, "Vote on at least one option"),
});

export type VoteState = { ok?: boolean; error?: string } | null;

export async function submitVotesAction(payload: unknown): Promise<VoteState> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid vote" };

  const ip = clientIpFromHeaders(await headers());
  if (!checkRateLimit(`poll-vote:ip:${ip}`, { limit: 30, windowMs: 60 * 1000 }).ok) {
    return { error: "Too many submissions. Please slow down and try again." };
  }

  const { token, voterName, voterEmail, choices } = parsed.data;
  const res = await submitPollVotes(token, { voterName, voterEmail, choices });
  return res.ok ? { ok: true } : { error: res.error };
}

const lookupSchema = z.object({
  token: z.string().min(1),
  voterEmail: z.string().email(),
});

export type MyVotesState = {
  voterName: string;
  choices: { optionId: number; choice: PollChoice }[];
} | null;

/** Prefill a returning voter's prior response when they enter their email. */
export async function myVotesAction(payload: unknown): Promise<MyVotesState> {
  const parsed = lookupSchema.safeParse(payload);
  if (!parsed.success) return null;
  return getVoterVotes(parsed.data.token, parsed.data.voterEmail);
}
