import type { NextConfig } from "next";

// No remote image optimizer or paid hosting features are needed for this MVP.
// NEXT_DIST_DIR lets tests and QA servers build beside a running `npm run dev` safely.
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
export default config;
