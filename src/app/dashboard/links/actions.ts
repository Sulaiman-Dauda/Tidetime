"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  createBookingLink,
  revokeBookingLink,
  userOwnsEventType,
} from "@/server/booking-links";
import { env } from "@/lib/env";

const createSchema = z.object({
  eventTypeId: z.coerce.number().int().positive(),
  kind: z.enum(["one_time", "expiring", "limited", "invite"]),
  maxUses: z.coerce.number().int().positive().optional(),
  expiresAt: z.string().optional(),
  inviteEmail: z.string().email().optional(),
});

export interface LinkState {
  ok?: boolean;
  error?: string;
  url?: string;
}

export async function createLinkAction(
  _prev: LinkState,
  formData: FormData,
): Promise<LinkState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({
    eventTypeId: formData.get("eventTypeId"),
    kind: formData.get("kind"),
    maxUses: formData.get("maxUses") || undefined,
    expiresAt: formData.get("expiresAt") || undefined,
    inviteEmail: formData.get("inviteEmail") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { eventTypeId, kind, maxUses, expiresAt, inviteEmail } = parsed.data;

  if (!(await userOwnsEventType(user.id, eventTypeId))) {
    return { error: "You do not own that event type" };
  }
  if (kind === "limited" && !maxUses) {
    return { error: "A usage limit is required for limited links" };
  }
  if (kind === "expiring" && !expiresAt) {
    return { error: "An expiry date is required for expiring links" };
  }
  if (kind === "invite" && !inviteEmail) {
    return { error: "An invite email is required for invite links" };
  }

  const { token } = await createBookingLink({
    eventTypeId,
    createdByUserId: user.id,
    kind,
    maxUses: kind === "limited" ? maxUses : null,
    expiresAt: kind === "expiring" && expiresAt ? new Date(expiresAt) : null,
    inviteEmail: kind === "invite" ? inviteEmail : null,
  });

  revalidatePath("/dashboard/links");
  return { ok: true, url: `${env.appUrl}/i/${token}` };
}

export async function revokeLinkAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  if (Number.isFinite(id)) {
    await revokeBookingLink(id, user.id);
    revalidatePath("/dashboard/links");
  }
}
