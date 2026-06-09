import { describe, expect, it } from "vitest";
import {
  bestOption,
  isPollChoice,
  isPollVisibility,
  projectPoll,
  rankOptions,
  tallyOptions,
  type PollVoteLite,
  type RawPollVote,
} from "./polls";

const votes: PollVoteLite[] = [
  { optionId: 1, choice: "yes" },
  { optionId: 1, choice: "yes" },
  { optionId: 1, choice: "no" },
  { optionId: 2, choice: "yes" },
  { optionId: 2, choice: "if_need_be" },
  { optionId: 2, choice: "if_need_be" },
  { optionId: 3, choice: "no" },
];

describe("tallyOptions", () => {
  it("counts each choice and scores yes=1, if_need_be=0.5", () => {
    const t = tallyOptions([1, 2, 3], votes);
    expect(t.find((o) => o.optionId === 1)).toMatchObject({ yes: 2, no: 1, ifNeedBe: 0, score: 2 });
    expect(t.find((o) => o.optionId === 2)).toMatchObject({ yes: 1, ifNeedBe: 2, no: 0, score: 2 });
    expect(t.find((o) => o.optionId === 3)).toMatchObject({ yes: 0, no: 1, score: 0 });
  });
  it("includes options with no votes", () => {
    expect(tallyOptions([9], [])).toEqual([{ optionId: 9, yes: 0, ifNeedBe: 0, no: 0, score: 0 }]);
  });
});

describe("rankOptions", () => {
  it("breaks score ties by more yes votes", () => {
    // option 1 and 2 both score 2; option 1 has more yes (2 vs 1) → ranks first
    const ranked = rankOptions([1, 2, 3], votes);
    expect(ranked.map((o) => o.optionId)).toEqual([1, 2, 3]);
  });
});

describe("bestOption", () => {
  it("returns the top-ranked option", () => {
    expect(bestOption([1, 2, 3], votes)).toBe(1);
  });
  it("returns null with no options", () => {
    expect(bestOption([], votes)).toBeNull();
  });
});

describe("isPollChoice", () => {
  it("validates the enum", () => {
    expect(isPollChoice("yes")).toBe(true);
    expect(isPollChoice("if_need_be")).toBe(true);
    expect(isPollChoice("maybe")).toBe(false);
  });
});

describe("isPollVisibility", () => {
  it("validates the enum", () => {
    expect(isPollVisibility("full")).toBe(true);
    expect(isPollVisibility("scores_only")).toBe(true);
    expect(isPollVisibility("limited")).toBe(true);
    expect(isPollVisibility("secret")).toBe(false);
  });
});

describe("projectPoll", () => {
  const raw: RawPollVote[] = [
    { optionId: 1, choice: "yes", voterName: "Ann", voterEmail: "ann@x.com" },
    { optionId: 2, choice: "no", voterName: "Ann", voterEmail: "ann@x.com" },
    { optionId: 1, choice: "if_need_be", voterName: "Bob", voterEmail: "bob@x.com" },
  ];

  it("full: everyone sees every vote, tallies correct", () => {
    const p = projectPoll([1, 2], raw, {
      visibility: "full",
      hideParticipants: false,
      viewerEmail: "ann@x.com",
      isOwner: false,
    });
    expect(p.showVoters).toBe(true);
    expect(p.votes).toHaveLength(3);
    expect(p.participantCount).toBe(2);
    expect(p.tallies.find((t) => t.optionId === 1)?.score).toBe(1.5);
    expect(p.votes.find((v) => v.voterLabel === "Ann" && v.own)).toBeTruthy();
  });

  it("hideParticipants masks names but not for the owner", () => {
    const masked = projectPoll([1, 2], raw, {
      visibility: "full",
      hideParticipants: true,
      viewerEmail: null,
      isOwner: false,
    });
    expect(masked.votes.every((v) => /^Participant \d+$/.test(v.voterLabel))).toBe(true);
    const owner = projectPoll([1, 2], raw, {
      visibility: "full",
      hideParticipants: true,
      viewerEmail: null,
      isOwner: true,
    });
    expect(owner.votes.some((v) => v.voterLabel === "Ann")).toBe(true);
  });

  it("scores_only: tallies but no individual votes", () => {
    const p = projectPoll([1, 2], raw, {
      visibility: "scores_only",
      hideParticipants: false,
      viewerEmail: "ann@x.com",
      isOwner: false,
    });
    expect(p.showVoters).toBe(false);
    expect(p.votes).toHaveLength(0);
    expect(p.participantCount).toBe(2);
    expect(p.tallies.find((t) => t.optionId === 1)?.score).toBe(1.5); // still accurate
  });

  it("limited: a voter sees only their own votes", () => {
    const p = projectPoll([1, 2], raw, {
      visibility: "limited",
      hideParticipants: false,
      viewerEmail: "ann@x.com",
      isOwner: false,
    });
    expect(p.votes).toHaveLength(2);
    expect(p.votes.every((v) => v.own && v.voterLabel === "Ann")).toBe(true);
    // owner still sees everything under limited
    const owner = projectPoll([1, 2], raw, {
      visibility: "limited",
      hideParticipants: false,
      viewerEmail: null,
      isOwner: true,
    });
    expect(owner.votes).toHaveLength(3);
  });
});
