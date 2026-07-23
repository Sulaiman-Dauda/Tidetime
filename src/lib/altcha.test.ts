import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createAltchaChallenge,
  verifyAltchaSolution,
  type AltchaChallenge,
} from "./altcha";

function solveChallenge(challenge: AltchaChallenge) {
  for (let number = 0; number <= challenge.maxnumber; number++) {
    const digest = createHash("sha256")
      .update(challenge.salt + number)
      .digest("hex");
    if (digest === challenge.challenge) {
      return { ...challenge, number };
    }
  }
  throw new Error("Challenge has no solution");
}

describe("ALTCHA proof-of-work", () => {
  it("round-trips a solved challenge", () => {
    const challenge = createAltchaChallenge();
    const solution = solveChallenge(challenge);
    expect(verifyAltchaSolution(solution)).toBe(true);
  });

  it("rejects a tampered number", () => {
    const challenge = createAltchaChallenge();
    const solution = solveChallenge(challenge);
    expect(verifyAltchaSolution({ ...solution, number: solution.number + 1 })).toBe(false);
  });

  it("rejects a forged signature", () => {
    const challenge = createAltchaChallenge();
    const solution = solveChallenge(challenge);
    expect(verifyAltchaSolution({ ...solution, signature: "00".repeat(32) })).toBe(false);
  });

  it("rejects an expired challenge", () => {
    const past = Date.now() - 60 * 60 * 1000;
    const challenge = createAltchaChallenge(past);
    const solution = solveChallenge(challenge);
    expect(verifyAltchaSolution(solution)).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(verifyAltchaSolution(null)).toBe(false);
    expect(verifyAltchaSolution({})).toBe(false);
    expect(verifyAltchaSolution({ algorithm: "SHA-256", number: -1 })).toBe(false);
  });
});
