import { describe, expect, it } from "vitest";
import { issueBotChallenge, verifyBotChallenge } from "./bot-challenge";

const SECRET = "test-secret-value-at-least-32-chars-long";

describe("bot-challenge", () => {
  it("accepts a token submitted within the valid window", () => {
    const t0 = 1_000_000_000_000;
    const token = issueBotChallenge(SECRET, t0);
    // 5 seconds later: past the 2s floor, well under the 2h ceiling.
    expect(verifyBotChallenge(SECRET, token, {}, t0 + 5_000)).toBe(true);
  });

  it("rejects submissions that arrive implausibly fast (bot)", () => {
    const t0 = 1_000_000_000_000;
    const token = issueBotChallenge(SECRET, t0);
    expect(verifyBotChallenge(SECRET, token, {}, t0 + 500)).toBe(false);
  });

  it("rejects stale forms past the ceiling", () => {
    const t0 = 1_000_000_000_000;
    const token = issueBotChallenge(SECRET, t0);
    expect(verifyBotChallenge(SECRET, token, {}, t0 + 3 * 60 * 60 * 1000)).toBe(false);
  });

  it("rejects a forged issue time (signature won't match)", () => {
    const t0 = 1_000_000_000_000;
    const token = issueBotChallenge(SECRET, t0);
    // Attacker rewrites the timestamp to look old enough to pass the floor.
    const forged = `${t0 - 10_000}.${token.split(".")[1]}`;
    expect(verifyBotChallenge(SECRET, forged, {}, t0 + 500)).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const t0 = 1_000_000_000_000;
    const token = issueBotChallenge("other-secret", t0);
    expect(verifyBotChallenge(SECRET, token, {}, t0 + 5_000)).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(verifyBotChallenge(SECRET, null)).toBe(false);
    expect(verifyBotChallenge(SECRET, "")).toBe(false);
    expect(verifyBotChallenge(SECRET, "no-separator")).toBe(false);
    expect(verifyBotChallenge(SECRET, ".onlysig")).toBe(false);
  });
});
