import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Minimal RFC 6238 TOTP (SHA-1, 6 digits, 30s steps) — the profile every
 * authenticator app supports. Zero dependencies by design.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(encoded: string): Uint8Array {
  const clean = encoded.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(output);
}

/** 160-bit random secret, base32-encoded for authenticator apps. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The 6-digit code for a secret at a given 30-second step. */
export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", Buffer.from(base32Decode(secret))).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

/**
 * Verify a user-supplied code, allowing one step of clock drift either way, and
 * return the 30-second step it matched — or null if it matched none.
 *
 * Callers guarding a login or a sensitive action must persist the returned step
 * and reject any later code whose step is not strictly greater. RFC 6238 §5.2:
 * a verifier must not accept a second use of the same OTP. Without that check a
 * single code stays usable for its whole ~90-second acceptance window.
 */
export function verifyTotpStep(
  secret: string,
  code: string,
  now: Date = new Date(),
): number | null {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;
  const step = Math.floor(now.getTime() / 30_000);
  for (const candidate of [step, step - 1, step + 1]) {
    const expected = totpCode(secret, candidate);
    if (
      expected.length === normalized.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))
    ) {
      return candidate;
    }
  }
  return null;
}

/** Boolean form of {@link verifyTotpStep}, for callers with no replay window to guard. */
export function verifyTotp(secret: string, code: string, now: Date = new Date()): boolean {
  return verifyTotpStep(secret, code, now) !== null;
}

/** otpauth:// URI for QR/manual entry in authenticator apps. */
export function totpUri(secret: string, accountLabel: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
