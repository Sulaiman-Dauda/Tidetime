import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1440px" },
    },
    extend: {
      colors: {
        canvas: token("canvas"),
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        segment: token("segment"),
        background: token("background"),
        foreground: token("foreground"),
        sidebar: {
          DEFAULT: token("sidebar"),
          border: token("sidebar-border"),
        },
        brand: {
          DEFAULT: token("brand"),
          foreground: token("brand-foreground"),
        },
        primary: {
          DEFAULT: token("primary"),
          foreground: token("primary-foreground"),
        },
        secondary: {
          DEFAULT: token("secondary"),
          foreground: token("secondary-foreground"),
        },
        destructive: {
          DEFAULT: token("destructive"),
          foreground: token("destructive-foreground"),
          subtle: token("destructive-subtle"),
        },
        success: {
          DEFAULT: token("success"),
          subtle: token("success-subtle"),
        },
        warning: {
          DEFAULT: token("warning"),
          subtle: token("warning-subtle"),
        },
        info: {
          DEFAULT: token("info"),
          subtle: token("info-subtle"),
        },
        muted: {
          DEFAULT: token("muted"),
          foreground: token("muted-foreground"),
        },
        accent: {
          DEFAULT: token("accent"),
          foreground: token("accent-foreground"),
        },
        popover: {
          DEFAULT: token("popover"),
          foreground: token("popover-foreground"),
        },
        card: {
          DEFAULT: token("card"),
          foreground: token("card-foreground"),
        },
      },
      borderRadius: {
        "2xl": "calc(var(--radius) + 6px)",
        xl: "calc(var(--radius) + 2px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 hsl(var(--shadow) / 0.05)",
        sm: "0 1px 2px 0 hsl(var(--shadow) / 0.06), 0 1px 3px 0 hsl(var(--shadow) / 0.04)",
        // Primary buttons: a faint top highlight gives the fill some depth.
        button:
          "inset 0 1px 0 0 hsl(0 0% 100% / 0.12), 0 1px 2px 0 hsl(var(--shadow) / 0.14)",
        // Menus, dialogs, toasts, the public booking card.
        popover:
          "0 0 0 1px hsl(var(--border) / 0.6), 0 4px 8px -2px hsl(var(--shadow) / 0.06), 0 16px 32px -8px hsl(var(--shadow) / 0.14)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      fontSize: {
        // Secondary row text, compact controls and table cells. Sits between
        // xs (12px) and sm (14px); nothing in the UI goes below xs.
        meta: ["0.8125rem", { lineHeight: "1.125rem" }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.18s ease-out",
        "accordion-up": "accordion-up 0.18s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
