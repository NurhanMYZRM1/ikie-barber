import type { Config } from "tailwindcss";

// Monochrome like the shop's poster. Accent flips with light/dark in globals.css.
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "var(--accent)",
        "on-accent": "var(--on-accent)",
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
        display: ["var(--font-display)", "Arial Narrow", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
