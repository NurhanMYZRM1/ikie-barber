import { describe, expect, it } from "vitest";
import { fromZonedTime } from "date-fns-tz";
import { demoCatalog } from "@/lib/demo";
import { quote, servicePrice, type Place } from "@/lib/pricing";
import type { PublicVisit } from "@/lib/types";

// These rules are repeated in private.validate_booking; tests/database.test.ts covers that side.
const [haircut, adult] = demoCatalog.services;
const bangi = demoCatalog.areas[2].id;
const visit = (services: PublicVisit["services"]): Place => ({
  kind: "university",
  visit: {
    id: "50000000-0000-4000-8000-000000000001",
    reserved_from: "",
    starts_at: "",
    ends_at: "",
    reserved_until: "",
    is_open: true,
    services,
  },
});
const at = (time: string) => fromZonedTime(time, "Asia/Kuala_Lumpur").toISOString();

describe("prices", () => {
  it("price by place; blank means not offered", () => {
    expect(servicePrice(haircut, { kind: "shop" })).toBe(8);
    expect(servicePrice(adult, { kind: "house_call", area_id: bangi })).toBe(35);
    expect(servicePrice(adult, { kind: "house_call", area_id: "elsewhere" })).toBeNull();
  });
  it("a visit price beats the service's uni price, which applies when the visit leaves it blank", () => {
    const uni = { ...haircut, university_price: 7 };
    expect(servicePrice(uni, visit({ [haircut.id]: 5 }))).toBe(5);
    expect(servicePrice(uni, visit({ [haircut.id]: null }))).toBe(7);
    expect(servicePrice(haircut, visit({ [haircut.id]: null }))).toBeNull();
    expect(servicePrice(uni, visit({}))).toBeNull();
  });
  it("adds only the extra charges whose rule applies, in cents", () => {
    const extras = demoCatalog.extras.map((extra, index) =>
      index === 0
        ? { ...extra, amount: 5.1, starts_from: "23:00:00" }
        : { ...extra, amount: 10.2, notice_hours: 3 },
    );
    const now = new Date(at("2026-11-08T20:00:00"));
    const price = (time: string, clock = now) =>
      quote(
        { ...haircut, shop_price: 8.7 },
        { kind: "shop" },
        extras,
        at(time),
        "Asia/Kuala_Lumpur",
        clock,
      );
    expect(price("2026-11-09T16:00:00")).toEqual({ price: 8.7, charges: [], total: 8.7 });
    expect(price("2026-11-09T23:00:00")?.total).toBe(13.8);
    expect(price("2026-11-08T22:30:00")?.charges.map((charge) => charge.label)).toEqual([
      "Last minute / urgent",
    ]);
    // Both rules: from 11 PM, and less than 3 hours ahead.
    expect(price("2026-11-08T23:30:00", new Date(at("2026-11-08T21:00:00")))?.total).toBe(24);
    // Listed-only charges are never added online.
    expect(
      quote(
        haircut,
        { kind: "shop" },
        demoCatalog.extras,
        at("2026-11-08T23:30:00"),
        "Asia/Kuala_Lumpur",
        now,
      )?.total,
    ).toBe(8);
    expect(
      quote(haircut, visit({}), extras, at("2026-11-09T16:00:00"), "Asia/Kuala_Lumpur", now),
    ).toBeNull();
  });
});
