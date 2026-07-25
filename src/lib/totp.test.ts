import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  totpCode,
  totpUri,
  verifyTotp,
  verifyTotpStep,
} from "./totp";

describe("totp", () => {
  it("round-trips base32", () => {
    const bytes = Uint8Array.from([0xde, 0xad, 0xbe, 0xef, 0x00, 0x42]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it("matches RFC 6238 SHA-1 test vectors", () => {
    // RFC secret "12345678901234567890" (ASCII) => base32
    const secret = base32Encode(new TextEncoder().encode("12345678901234567890"));
    // T = 59s => step 1 => 94287082 (8-digit); last 6 digits = 287082
    expect(totpCode(secret, Math.floor(59 / 30))).toBe("287082");
    // T = 1111111109 => 081804 (last 6 of 07081804)
    expect(totpCode(secret, Math.floor(1111111109 / 30))).toBe("081804");
  });

  it("verifies current codes and tolerates one step of drift", () => {
    const secret = generateTotpSecret();
    const now = new Date("2026-07-24T12:00:00Z");
    const step = Math.floor(now.getTime() / 30_000);
    expect(verifyTotp(secret, totpCode(secret, step), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, step - 1), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, step + 1), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, step + 2), now)).toBe(false);
    expect(verifyTotp(secret, "12345", now)).toBe(false);
    expect(verifyTotp(secret, "abcdef", now)).toBe(false);
  });

  it("reports which step a code matched, so callers can enforce single use", () => {
    const secret = generateTotpSecret();
    const now = new Date("2026-07-24T12:00:00Z");
    const step = Math.floor(now.getTime() / 30_000);
    expect(verifyTotpStep(secret, totpCode(secret, step), now)).toBe(step);
    expect(verifyTotpStep(secret, totpCode(secret, step - 1), now)).toBe(step - 1);
    expect(verifyTotpStep(secret, totpCode(secret, step + 1), now)).toBe(step + 1);
    expect(verifyTotpStep(secret, totpCode(secret, step + 2), now)).toBeNull();
    expect(verifyTotpStep(secret, "abcdef", now)).toBeNull();
  });

  it("gives callers what they need to reject a replayed code", () => {
    // The guard callers implement: accept only a step strictly greater than the
    // last one consumed. Without it a single code stays good for ~90 seconds.
    const secret = generateTotpSecret();
    const now = new Date("2026-07-24T12:00:00Z");
    const step = Math.floor(now.getTime() / 30_000);
    const code = totpCode(secret, step);

    const first = verifyTotpStep(secret, code, now);
    expect(first).toBe(step);

    // Same code, same window — still cryptographically valid...
    const second = verifyTotpStep(secret, code, now);
    expect(second).toBe(step);
    // ...but not strictly greater than what was consumed, so callers reject it.
    expect(second !== null && first !== null && second <= first).toBe(true);
  });

  it("builds an otpauth URI", () => {
    const uri = totpUri("ABC234", "user@example.com", "Tidetime");
    expect(uri).toContain("otpauth://totp/Tidetime%3Auser%40example.com");
    expect(uri).toContain("secret=ABC234");
    expect(uri).toContain("issuer=Tidetime");
  });
});
