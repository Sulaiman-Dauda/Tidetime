import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("treats text-meta as a font size, not a colour", () => {
    expect(cn("text-primary-foreground", "text-meta")).toBe("text-primary-foreground text-meta");
    expect(cn("text-sm", "text-meta")).toBe("text-meta");
  });

  it("treats the custom shadows as shadows", () => {
    expect(cn("shadow-xs", "shadow-popover")).toBe("shadow-popover");
    expect(cn("shadow-button", "shadow-none")).toBe("shadow-none");
  });
});
