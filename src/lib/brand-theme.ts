/**
 * Turns the company brand colour into the accent tokens used on public pages
 * (booking, confirmation, legal). The dashboard keeps Tidetime indigo.
 *
 * Links, icons and selection borders are drawn in the brand colour, so it has
 * to read against the page. Before this the setting only painted a thin bar,
 * so installs may hold a colour that was harmless there and unreadable as link
 * text. The light theme uses the colour as entered unless it falls below 3:1,
 * then deepens it just far enough. The dark theme lightens it to at least 62%,
 * and further if it still falls below 3:1. Text on a brand fill is white or
 * near-black, whichever has the higher contrast.
 */

type Hsl = { h: number; s: number; l: number };

const INK = "222 22% 11%"; // matches --foreground in globals.css
const WHITE = "0 0% 100%";

function expandHex(hex: string): string {
  const v = hex.replace("#", "");
  return v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
}

function hexToRgb(hex: string): [number, number, number] {
  const v = expandHex(hex);
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function rgbToHsl([r, g, b]: [number, number, number]): Hsl {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Luminance of the colour as the browser paints it, in 8-bit sRGB. */
function paintedLuminance(colour: Hsl): number {
  return luminance(hslToRgb(colour).map((c) => Math.round(c * 255) / 255) as [number, number, number]);
}

const INK_LUMINANCE = paintedLuminance({ h: 222, s: 22, l: 11 });
// Brand marks are measured against the hardest surface they sit on: --secondary,
// behind a highlighted select item, is the darkest light surface and the
// lightest neutral dark one in globals.css.
const LIGHT_SURFACE_LUMINANCE = paintedLuminance({ h: 220, s: 14, l: 95.5 });
const DARK_SURFACE_LUMINANCE = paintedLuminance({ h: 225, s: 8, l: 15 });

/** WCAG 2.2 minimum for user-interface components and large text. */
const MIN_CONTRAST = 3;

/**
 * Steps lightness by `step` until the colour reaches MIN_CONTRAST on the
 * surface. Works in whole numbers, the precision fmt() emits, so the colour
 * that ships is the one that was measured.
 */
function reachContrast(colour: Hsl, surface: number, step: 1 | -1): Hsl {
  const c = { h: Math.round(colour.h), s: Math.round(colour.s), l: Math.round(colour.l) };
  while ((step < 0 ? c.l > 0 : c.l < 100) && contrast(paintedLuminance(c), surface) < MIN_CONTRAST) {
    c.l += step;
  }
  return c;
}

/** White or ink, whichever reads better on the given fill. */
function readableOn(fill: Hsl): string {
  const lum = paintedLuminance(fill);
  return contrast(lum, 1) >= contrast(lum, INK_LUMINANCE) ? WHITE : INK;
}

function fmt({ h, s, l }: Hsl): string {
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

export interface BrandTokens {
  primary: string;
  "primary-foreground": string;
  ring: string;
  accent: string;
  "accent-foreground": string;
}

export function brandTokens(hex: string): { light: BrandTokens; dark: BrandTokens } {
  const base = rgbToHsl(hexToRgb(hex));
  const tintSat = Math.min(base.s, 85);

  const lightPrimary = reachContrast(base, LIGHT_SURFACE_LUMINANCE, -1);
  // 62% first: a deep colour lifted only to 3:1 still looks muddy on a dark page.
  const darkPrimary = reachContrast({ ...base, l: Math.max(base.l, 62) }, DARK_SURFACE_LUMINANCE, 1);

  return {
    light: {
      primary: fmt(lightPrimary),
      "primary-foreground": readableOn(lightPrimary),
      ring: fmt(lightPrimary),
      accent: fmt({ h: base.h, s: tintSat, l: 96 }),
      "accent-foreground": fmt({ h: base.h, s: tintSat, l: 30 }),
    },
    dark: {
      primary: fmt(darkPrimary),
      "primary-foreground": readableOn(darkPrimary),
      ring: fmt(darkPrimary),
      accent: fmt({ h: base.h, s: Math.min(base.s, 35), l: 16 }),
      "accent-foreground": fmt({ h: base.h, s: tintSat, l: 82 }),
    },
  };
}

function declarations(tokens: BrandTokens): string {
  return Object.entries(tokens)
    .map(([name, value]) => `--${name}:${value};`)
    .join("");
}

/**
 * CSS that applies the brand tokens to the whole document while an element
 * with `data-brand-scope` is mounted. Scoping on :root (rather than on the
 * wrapper) also reaches Radix portals: select menus and dialogs render
 * outside the page tree.
 */
export function brandThemeCss(hex: string): string {
  const { light, dark } = brandTokens(hex);
  return (
    `:root:has([data-brand-scope]){${declarations(light)}}` +
    `:root.dark:has([data-brand-scope]){${declarations(dark)}}`
  );
}
