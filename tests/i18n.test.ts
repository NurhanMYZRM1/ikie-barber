import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MS, translate } from "@/lib/i18n";
import { demoHours, demoShop } from "@/lib/demo";
import { getShopStatus } from "@/lib/time";
import { fromZonedTime } from "date-fns-tz";

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
const source = ["app", "components", "lib"].flatMap(files).map((path) => ({
  path,
  text: readFileSync(path, "utf8"),
}));
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("Malay translations", () => {
  it("cover every string passed to t() or translate()", () => {
    const missing = source.flatMap(({ path, text }) =>
      [...text.matchAll(/\b(?:t|translate)\(\s*(?:lang,\s*)?"((?:[^"\\]|\\.)*)"/g)]
        .map((match) => match[1])
        .filter((key) => !(key in MS))
        .map((key) => `${path}: ${key}`),
    );
    expect(missing).toEqual([]);
  });
  it("cover every server and validation message, which are translated where shown", () => {
    const messages = source
      .filter(({ path }) => /actions\.ts$|validation\.ts$/.test(path))
      .flatMap(({ text }) => [...text.matchAll(/"([A-Z][^"]*[.!])"/g)].map((m) => m[1]));
    expect(messages.length).toBeGreaterThan(20);
    expect(messages.filter((message) => !(message in MS))).toEqual([]);
  });
  it("keep the same {placeholders} as the English text", () => {
    for (const [english, malay] of Object.entries(MS))
      expect(placeholders(malay), english).toEqual(placeholders(english));
  });
  it("translate status labels with Malay dates", () => {
    const at = (time: string) => fromZonedTime(time, demoShop.timezone);
    expect(getShopStatus(demoShop, demoHours, at("2026-10-22T16:00:00"), "ms").label).toBe(
      "Buka sekarang · Tutup pukul 6:30 PM",
    );
    expect(
      getShopStatus(
        { ...demoShop, is_available: false, unavailable_until: "2026-10-29" },
        demoHours,
        at("2026-10-22T16:00:00"),
        "ms",
      ).label,
    ).toBe("Tidak tersedia sehingga Kha, 29 Okt");
    expect(translate("ms", "Not in the dictionary")).toBe("Not in the dictionary");
  });
});
