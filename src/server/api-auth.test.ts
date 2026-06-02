import { describe, it, expect } from "vitest";
import { parsePage } from "./api-auth";
import type { NextRequest } from "next/server";

/** Build a minimal NextRequest-like object exposing only nextUrl.searchParams. */
function reqWith(query: string): NextRequest {
  const url = new URL(`http://localhost/api/v1/things${query}`);
  return { nextUrl: url } as unknown as NextRequest;
}

describe("parsePage", () => {
  it("defaults to limit 50 / offset 0", () => {
    expect(parsePage(reqWith(""))).toEqual({ limit: 50, offset: 0 });
  });

  it("reads explicit limit and offset", () => {
    expect(parsePage(reqWith("?limit=25&offset=100"))).toEqual({ limit: 25, offset: 100 });
  });

  it("caps the limit at the maximum", () => {
    expect(parsePage(reqWith("?limit=10000")).limit).toBe(200);
  });

  it("derives offset from page number", () => {
    expect(parsePage(reqWith("?page=3&limit=20"))).toEqual({ limit: 20, offset: 40 });
  });

  it("ignores negative or invalid values", () => {
    expect(parsePage(reqWith("?limit=-5&offset=-10"))).toEqual({ limit: 50, offset: 0 });
    expect(parsePage(reqWith("?limit=abc"))).toEqual({ limit: 50, offset: 0 });
  });

  it("respects custom default and max", () => {
    expect(parsePage(reqWith(""), 10, 30)).toEqual({ limit: 10, offset: 0 });
    expect(parsePage(reqWith("?limit=100"), 10, 30).limit).toBe(30);
  });
});
