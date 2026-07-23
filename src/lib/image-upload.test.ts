import { describe, expect, it } from "vitest";
import { buildImageDataUrl } from "./image-upload";

function pad(bytes: number[]): Uint8Array {
  // Pad to >= 12 bytes so the sniffer has enough header to inspect.
  const out = new Uint8Array(Math.max(16, bytes.length));
  out.set(bytes);
  return out;
}

const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = pad([0xff, 0xd8, 0xff, 0xe0]);
const GIF = pad([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const WEBP = pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

describe("buildImageDataUrl", () => {
  it("detects real raster formats from magic bytes", () => {
    for (const [bytes, mime] of [
      [PNG, "image/png"],
      [JPEG, "image/jpeg"],
      [GIF, "image/gif"],
      [WEBP, "image/webp"],
    ] as const) {
      const result = buildImageDataUrl(bytes);
      expect("dataUrl" in result && result.dataUrl.startsWith(`data:${mime};base64,`)).toBe(true);
    }
  });

  it("rejects SVG and other non-raster / spoofed content", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
    const html = new TextEncoder().encode("<!DOCTYPE html><script>alert(1)</script>");
    for (const bytes of [svg, html, pad([0x00, 0x01, 0x02])]) {
      expect("error" in buildImageDataUrl(bytes)).toBe(true);
    }
  });
  it("produces a data URL whose MIME comes from the bytes, not any header", () => {
    const res = buildImageDataUrl(PNG);
    expect("dataUrl" in res && res.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("rejects oversized uploads", () => {
    const big = new Uint8Array(2 * 1024 * 1024);
    big.set(PNG);
    const res = buildImageDataUrl(big);
    expect("error" in res).toBe(true);
  });

  it("rejects content that isn't an allowed image", () => {
    const svg = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
    const res = buildImageDataUrl(svg);
    expect("error" in res).toBe(true);
  });
});
