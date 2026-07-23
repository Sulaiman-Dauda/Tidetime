import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, totpCode, totpUri, verifyTotp } from "./totp";

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

  it("builds an otpauth URI", () => {
    const uri = totpUri("ABC234", "user@example.com", "Tidetime");
    expect(uri).toContain("otpauth://totp/Tidetime%3Auser%40example.com");
    expect(uri).toContain("secret=ABC234");
    expect(uri).toContain("issuer=Tidetime");
  });
});
