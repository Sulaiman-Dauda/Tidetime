/**
 * Pure tally + ranking for meeting polls. "yes" is worth a full point,
 * "if_need_be" half a point, "no" nothing. Options are ranked by score, then by
 * most yes votes, then by fewest no votes — the classic Doodle ordering. No I/O.
 */

export type PollChoice = "yes" | "no" | "if_need_be";

export function isPollChoice(v: unknown): v is PollChoice {
  return v === "yes" || v === "no" || v === "if_need_be";
}

export interface PollVoteLite {
  optionId: number;
  choice: PollChoice;
}

export interface OptionTally {
  optionId: number;
  yes: number;
  ifNeedBe: number;
  no: number;
  /** yes * 1 + ifNeedBe * 0.5 */
  score: number;
}

export function tallyOptions(optionIds: number[], votes: PollVoteLite[]): OptionTally[] {
  const tallies = new Map<number, OptionTally>();
  for (const id of optionIds) {
    tallies.set(id, { optionId: id, yes: 0, ifNeedBe: 0, no: 0, score: 0 });
  }
  for (const v of votes) {
    const t = tallies.get(v.optionId);
    if (!t) continue;
    if (v.choice === "yes") t.yes++;
    else if (v.choice === "if_need_be") t.ifNeedBe++;
    else t.no++;
  }
  for (const t of tallies.values()) t.score = t.yes + t.ifNeedBe * 0.5;
  return optionIds.map((id) => tallies.get(id)!);
}

/** Rank options best-first: score desc, then yes desc, then no asc, then id asc. */
export function rankOptions(optionIds: number[], votes: PollVoteLite[]): OptionTally[] {
  return [...tallyOptions(optionIds, votes)].sort(
    (a, b) =>
      b.score - a.score || b.yes - a.yes || a.no - b.no || a.optionId - b.optionId,
  );
}

/** The recommended option (highest ranked), or null when there are no options. */
export function bestOption(optionIds: number[], votes: PollVoteLite[]): number | null {
  const ranked = rankOptions(optionIds, votes);
  return ranked[0]?.optionId ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Result visibility (stolen from Rallly)                                     */
/* -------------------------------------------------------------------------- */

export type PollVisibility = "full" | "scores_only" | "limited";

export function isPollVisibility(v: unknown): v is PollVisibility {
  return v === "full" || v === "scores_only" || v === "limited";
}

export interface RawPollVote {
  optionId: number;
  choice: PollChoice;
  voterName: string;
  voterEmail: string;
}

export interface VisiblePollVote {
  optionId: number;
  choice: PollChoice;
  /** display label — real name, or "Participant N" when names are hidden */
  voterLabel: string;
  /** true when this is the current viewer's own vote */
  own: boolean;
}

export interface PollProjection {
  /** aggregate tallies — ALWAYS computed from every vote, regardless of visibility */
  tallies: OptionTally[];
  /** the individual votes this viewer is allowed to see */
  votes: VisiblePollVote[];
  /** whether the per-participant grid should render at all */
  showVoters: boolean;
  /** distinct participant count (so "12 responded" is honest even when hidden) */
  participantCount: number;
}

/**
 * Project a poll's votes for one viewer, honouring the poll's visibility setting:
 * - host (isOwner) always sees everything with real names;
 * - "full": every participant's votes are visible to everyone;
 * - "scores_only": only aggregate tallies — no per-participant grid;
 * - "limited": a voter sees only their own votes, plus the aggregate.
 * Names are additionally masked when `hideParticipants` is set (host exempt).
 * Tallies are computed from ALL votes either way, so scores never lie.
 */
export function projectPoll(
  optionIds: number[],
  votes: RawPollVote[],
  opts: {
    visibility: PollVisibility;
    hideParticipants: boolean;
    viewerEmail: string | null;
    isOwner: boolean;
  },
): PollProjection {
  const tallies = tallyOptions(optionIds, votes);
  const distinctEmails = [...new Set(votes.map((v) => v.voterEmail.toLowerCase()))];
  const participantCount = distinctEmails.length;
  const viewer = opts.viewerEmail?.trim().toLowerCase() ?? null;

  // Stable "Participant N" labels by first-seen email order.
  const labelFor = (email: string, name: string): string => {
    if (opts.isOwner || !opts.hideParticipants) return name;
    const idx = distinctEmails.indexOf(email.toLowerCase());
    return `Participant ${idx + 1}`;
  };

  const toVisible = (list: RawPollVote[]): VisiblePollVote[] =>
    list.map((v) => ({
      optionId: v.optionId,
      choice: v.choice,
      voterLabel: labelFor(v.voterEmail, v.voterName),
      own: viewer !== null && v.voterEmail.toLowerCase() === viewer,
    }));

  if (opts.isOwner || opts.visibility === "full") {
    return { tallies, votes: toVisible(votes), showVoters: true, participantCount };
  }
  if (opts.visibility === "limited") {
    const own = viewer ? votes.filter((v) => v.voterEmail.toLowerCase() === viewer) : [];
    return { tallies, votes: toVisible(own), showVoters: true, participantCount };
  }
  // scores_only
  return { tallies, votes: [], showVoters: false, participantCount };
}
