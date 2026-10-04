import { describe, expect, it } from "vitest";
import { brandThemeCss, brandTokens } from "./brand-theme";

// Retyped from the WCAG definition rather than imported, so a slip in the
// module's copy of the maths shows up here.
function contrastOn(token: string, page: [number, number, number]): number {
  const [h, s, l] = token.replace(/%/g, "").split(" ").map(Number);
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const lum = ([r, g, b]: number[]) => {
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const [x, y] = [lum([f(0), f(8), f(4)]), lum(page.map((c) => c / 255))].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
const LIGHT_SURFACE: [number, number, number] = [242, 243, 245]; // --secondary, hsl(220 14% 95.5%)
const DARK_SURFACE: [number, number, number] = [35, 37, 41]; // .dark --secondary, hsl(225 8% 15%)

describe("brandTokens", () => {
  it("uses a brand colour that already reads on the page exactly", () => {
    // #0f766e: hsl(175, 77%, 26%)
    expect(brandTokens("#0f766e").light.primary).toBe("175 77% 26%");
    // #ef4444 is about 3.4:1 on the darkest light surface, so it is left alone too.
    expect(brandTokens("#ef4444").light.primary).toBe("0 84% 60%");
  });

  it("deepens a pale brand colour until links drawn in it reach 3:1 on the page", () => {
    // Harmless as the old 4px bar, about 1.5:1 as link text.
    // The sky and blue shades sit just under 3:1, where rounding the emitted
    // token used to tip a corrected colour back below it.
    for (const pale of ["#facc15", "#a3e635", "#ffffff", "#38bdf8", "#60a5fa", "#69d7fa"]) {
      const { light } = brandTokens(pale);
      expect(contrastOn(light.primary, LIGHT_SURFACE)).toBeGreaterThanOrEqual(3);
    }
    // Same hue and saturation, only darker.
    expect(brandTokens("#facc15").light.primary).toMatch(/^48 96% \d+%$/);
  });

  it("lifts a deep brand colour until it reaches 3:1 on the dark theme", () => {
    for (const deep of ["#0000ff", "#1e1b4b", "#000000", "#050ff5"]) {
      expect(contrastOn(brandTokens(deep).dark.primary, DARK_SURFACE)).toBeGreaterThanOrEqual(3);
    }
  });

  it("puts white text on a dark brand colour and ink on a pale one", () => {
    expect(brandTokens("#0f766e").light["primary-foreground"]).toBe("0 0% 100%");
    expect(brandTokens("#facc15").light["primary-foreground"]).toBe("222 22% 11%");
  });

  it("lifts a deep brand colour in the dark theme so it reads on a dark page", () => {
    const { dark } = brandTokens("#0f766e");
    expect(dark.primary).toBe("175 77% 62%");
    expect(dark["primary-foreground"]).toBe("222 22% 11%");
  });

  it("leaves an already light brand colour alone in the dark theme", () => {
    // #a5b4fc: hsl(230, 94%, 82%)
    expect(brandTokens("#a5b4fc").dark.primary).toBe("230 94% 82%");
  });

  it("accepts three-digit hex", () => {
    expect(brandTokens("#f00").light.primary).toBe("0 100% 50%");
  });
});

describe("brandThemeCss", () => {
  it("scopes light and dark tokens to pages that mount the brand scope", () => {
    const css = brandThemeCss("#0f766e");
    expect(css).toContain(":root:has([data-brand-scope]){--primary:175 77% 26%;");
    expect(css).toContain(":root.dark:has([data-brand-scope]){--primary:175 77% 62%;");
  });
});
