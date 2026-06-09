"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { cancelPoll, createPoll, finalizePoll } from "@/server/polls";

const createSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  description: z.string().max(2000).optional(),
  location: z.string().max(500).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(1440),
  timeZone: z.string().min(1),
  /** option start times as ISO strings */
  options: z.array(z.string().datetime()).min(1, "Add at least one time option").max(30),
  visibility: z.enum(["full", "scores_only", "limited"]).optional(),
  hideParticipants: z.coerce.boolean().optional(),
});

export type PollState = { ok?: boolean; error?: string; token?: string; uid?: string } | null;

export async function createPollAction(payload: unknown): Promise<PollState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid poll" };
  const { title, description, location, durationMinutes, timeZone, options, visibility, hideParticipants } =
    parsed.data;
  const token = await createPoll(user.id, {
    title,
    description: description ?? null,
    location: location ?? null,
    durationMinutes,
    timeZone,
    options: options.map((iso) => {
      const start = new Date(iso);
      return { start, end: new Date(start.getTime() + durationMinutes * 60_000) };
    }),
    visibility: visibility ?? "full",
    hideParticipants: hideParticipants ?? false,
  });
  revalidatePath("/dashboard/polls");
  return { ok: true, token };
}

export async function finalizePollAction(pollId: number, optionId: number): Promise<PollState> {
  const user = await requireUser();
  const res = await finalizePoll(pollId, user.id, optionId);
  if (!res.ok) return { error: res.error };
  revalidatePath("/dashboard/polls");
  revalidatePath(`/dashboard/polls/${pollId}`);
  return { ok: true, uid: res.uid };
}

export async function cancelPollAction(pollId: number): Promise<PollState> {
  const user = await requireUser();
  await cancelPoll(pollId, user.id);
  revalidatePath("/dashboard/polls");
  return { ok: true };
}
