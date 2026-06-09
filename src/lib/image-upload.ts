/**
 * Server-side image validation for user uploads (avatars, team logos).
 *
 * The client-supplied `Content-Type` header is attacker-controlled and must never
 * be trusted: a request can claim `image/png` while carrying an HTML/SVG payload,
 * which would then execute if the stored value is ever rendered as a document.
 * We sniff the leading "magic bytes" instead and only accept a small allowlist of
 * raster formats. SVG is deliberately rejected because it can contain script.
 */

export const MAX_IMAGE_BYTES = 1 * 1024 * 1024; // 1 MB

export type SafeImageMime =
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp";

/**
 * Inspect the first bytes of an upload and return the real, safe MIME type, or
 * null when the content is not an allowed raster image. The returned type comes
 * from the bytes, not from any header.
 */
export function sniffImageMime(buf: Uint8Array): SafeImageMime | null {
  if (buf.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }

  // GIF: "GIF87a" / "GIF89a"
  if (
    buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 &&
    buf[3] === 0x38 && (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61
  ) {
    return "image/gif";
  }

  // WEBP: "RIFF"<4 bytes>"WEBP"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * Validate an uploaded image buffer and produce a safe `data:` URL for storage,
 * or an error string suitable for a 400 response. The MIME type embedded in the
 * data URL is derived from the bytes, never from the request header.
 */
export function buildImageDataUrl(
  buf: Uint8Array,
): { dataUrl: string } | { error: string } {
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    return { error: "Image must be under 1 MB" };
  }
  const mime = sniffImageMime(buf);
  if (!mime) {
    return { error: "Only PNG, JPEG, GIF or WebP images are allowed" };
  }
  const base64 = Buffer.from(buf).toString("base64");
  return { dataUrl: `data:${mime};base64,${base64}` };
}
