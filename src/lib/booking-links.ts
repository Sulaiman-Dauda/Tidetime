/**
 * Pure validation for temporary / one-time booking links. Decides whether a
 * link may currently be used to make a booking, independent of the database.
 */

export type BookingLinkKind = "one_time" | "expiring" | "limited" | "invite";

export interface BookingLinkState {
  kind: BookingLinkKind;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date | null;
  inviteEmail: string | null;
  revoked: boolean;
}

export type LinkValidation =
  | { ok: true }
  | { ok: false; reason: "revoked" | "expired" | "exhausted" | "wrong_invitee" };

/**
 * Validate a booking link for use.
 * @param state      stored link state
 * @param now        reference time
 * @param attendeeEmail email of the person attempting to book (for invite links)
 */
export function validateBookingLink(
  state: BookingLinkState,
  now: Date = new Date(),
  attendeeEmail?: string,
): LinkValidation {
  if (state.revoked) return { ok: false, reason: "revoked" };

  if (state.expiresAt && state.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }

  // one_time links are implicitly single-use.
  const effectiveMax = state.kind === "one_time" ? 1 : state.maxUses;
  if (effectiveMax != null && state.usedCount >= effectiveMax) {
    return { ok: false, reason: "exhausted" };
  }

  if (state.kind === "invite" && state.inviteEmail) {
    if (!attendeeEmail || attendeeEmail.toLowerCase() !== state.inviteEmail.toLowerCase()) {
      return { ok: false, reason: "wrong_invitee" };
    }
  }

  return { ok: true };
}

export const LINK_ERROR_MESSAGES: Record<
  Exclude<LinkValidation, { ok: true }>["reason"],
  string
> = {
  revoked: "This booking link has been revoked.",
  expired: "This booking link has expired.",
  exhausted: "This booking link has already been used.",
  wrong_invitee: "This booking link is reserved for a specific invitee.",
};
