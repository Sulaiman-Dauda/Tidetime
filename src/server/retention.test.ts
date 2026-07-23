import { describe, expect, it } from "vitest";
import { retentionCutoff } from "./retention";

describe("retentionCutoff", () => {
  const now = new Date("2026-06-07T00:00:00Z");

  it("returns null when retention is disabled", () => {
    expect(retentionCutoff(0, now)).toBeNull();
    expect(retentionCutoff(-5, now)).toBeNull();
    expect(retentionCutoff(Number.NaN, now)).toBeNull();
  });

  it("subtracts the retention window in days", () => {
    expect(retentionCutoff(30, now)?.toISOString()).toBe("2026-05-08T00:00:00.000Z");
    expect(retentionCutoff(1, now)?.toISOString()).toBe("2026-06-06T00:00:00.000Z");
  });
});
