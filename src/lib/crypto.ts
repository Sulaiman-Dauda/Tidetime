import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  createHash,
  createHmac,
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  type ScryptOptions,
} from "node:crypto";
import { env } from "./env";

function scrypt(
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derived) =>
      err ? reject(err) : resolve(derived),
    );
  });
}

const KEYLEN = 64;

/*
 * scrypt cost parameters, stored with every hash so they can be raised later
 * without invalidating existing passwords. N=2^16 (64 MiB) balances GPU/ASIC
 * resistance against memory pressure on small self-hosted boxes; login is
 * rate-limited, which bounds concurrent derivations.
 */
const SCRYPT_LOG_N = 16;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function scryptOptions(logN: number, r: number, p: number) {
  // Node's default maxmem (32 MiB) is below 128 * N * r; give headroom.
  return { N: 1 << logN, r, p, maxmem: 256 * (1 << logN) * r };
}

/** Hash a password with scrypt. Returns "scrypt$logN$r$p$salt$hash" (hex). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(
    password,
    salt,
    KEYLEN,
    scryptOptions(SCRYPT_LOG_N, SCRYPT_R, SCRYPT_P),
  );
  return `scrypt$${SCRYPT_LOG_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived.toString("hex")}`;
}

/** Verify a password against a stored hash in constant time. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const logN = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const hash = parts[5];
  if (!Number.isInteger(logN) || logN < 10 || logN > 20) return false;
  if (!Number.isInteger(r) || r < 1 || r > 32) return false;
  if (!Number.isInteger(p) || p < 1 || p > 16) return false;
  if (!salt || !hash) return false;
  const derived = await scrypt(password, salt, KEYLEN, scryptOptions(logN, r, p));
  const hashBuf = Buffer.from(hash, "hex");
  if (hashBuf.length !== derived.length) return false;
  return timingSafeEqual(hashBuf, derived);
}

/** Generate a cryptographically-random URL-safe token. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Short opaque identifier for booking UIDs etc. */
export function shortId(bytes = 12): string {
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256 hex digest used for opaque tokens and constant-length comparisons. */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** HMAC-SHA256 hex signature for webhook payloads. */
export function hmacSign(payload: string, secret: string | Buffer): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/* ---- Key derivation ------------------------------------------------------ */

/**
 * Derive a purpose-specific subkey from AUTH_SECRET via HKDF-SHA256 so no two
 * cryptographic uses (encryption, state signing, tokens…) share raw key
 * material. `purpose` acts as the HKDF info label — never reuse one.
 */
export function deriveKey(purpose: string, length = 32): Buffer {
  return Buffer.from(hkdfSync("sha256", env.authSecret, "", `tidetime:${purpose}`, length));
}

/* ---- AES-256-GCM for at-rest encryption of integration credentials ------- */

function encKey(): Buffer {
  return deriveKey("credentials-encryption");
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decrypt(blob: string): string {
  const [ivB, tagB, dataB] = blob.split(".");
  const decipher = createDecipheriv("aes-256-gcm", encKey(), Buffer.from(ivB, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
