import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Self-hosted ALTCHA proof-of-work challenge/response — a privacy-friendly,
 * GDPR-safe alternative to reCAPTCHA that runs entirely on our own server with
 * no third-party calls. Implements the ALTCHA protocol
 * (https://altcha.org/docs/challenge-and-verification/) so the official
 * `<altcha>` widget *or* our tiny built-in solver can satisfy it.
 *
 * The client must find the integer `number` in [0, maxnumber] such that
 * SHA-256(salt + number) === challenge. We bind the salt to an expiry and sign
 * the challenge with an HMAC keyed by AUTH_SECRET so solutions can't be forged.
 */

export const ALTCHA_ALGORITHM = "SHA-256";
export const ALTCHA_MAX_NUMBER = 100_000;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

export interface AltchaChallenge {
  algorithm: string;
  challenge: string;
  salt: string;
  signature: string;
  maxnumber: number;
}

export interface AltchaSolution {
  algorithm: string;
  challenge: string;
  number: number;
  salt: string;
  signature: string;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function hmacHex(input: string): string {
  return createHmac("sha256", env.authSecret).update(input).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Mint a fresh challenge. `number` is chosen server-side and never sent. */
export function createAltchaChallenge(now = Date.now()): AltchaChallenge {
  const number = randomBytes(4).readUInt32BE(0) % (ALTCHA_MAX_NUMBER + 1);
  // The salt carries an expiry so a captured challenge can't be replayed forever.
  const salt = `${randomBytes(12).toString("hex")}.${now + CHALLENGE_TTL_MS}`;
  const challenge = sha256Hex(salt + number);
  const signature = hmacHex(challenge);
  return { algorithm: ALTCHA_ALGORITHM, challenge, salt, signature, maxnumber: ALTCHA_MAX_NUMBER };
}

/** Verify a client's solution. Pure (except clock); safe to unit test. */
export function verifyAltchaSolution(solution: unknown, now = Date.now()): boolean {
  if (typeof solution !== "object" || solution === null) return false;
  const s = solution as Partial<AltchaSolution>;
  if (
    s.algorithm !== ALTCHA_ALGORITHM ||
    typeof s.challenge !== "string" ||
    typeof s.salt !== "string" ||
    typeof s.signature !== "string" ||
    typeof s.number !== "number" ||
    !Number.isInteger(s.number) ||
    s.number < 0 ||
    s.number > ALTCHA_MAX_NUMBER
  ) {
    return false;
  }
  // Salt expiry.
  const expiry = Number(s.salt.split(".")[1]);
  if (!Number.isFinite(expiry) || expiry < now) return false;
  // The challenge must be the hash we'd compute, and our signature over it.
  if (!safeEqualHex(sha256Hex(s.salt + s.number), s.challenge)) return false;
  if (!safeEqualHex(hmacHex(s.challenge), s.signature)) return false;
  return true;
}

/**
 * Reference solver — brute-forces the number. Used by the built-in widget and by
 * tests. Returns null if no solution is found within maxnumber (shouldn't happen
 * for a well-formed challenge).
 */
export function solveAltchaChallenge(challenge: AltchaChallenge): AltchaSolution | null {
  for (let number = 0; number <= challenge.maxnumber; number++) {
    if (sha256Hex(challenge.salt + number) === challenge.challenge) {
      return {
        algorithm: challenge.algorithm,
        challenge: challenge.challenge,
        number,
        salt: challenge.salt,
        signature: challenge.signature,
      };
    }
  }
  return null;
}
