import { describe, it, expect } from "vitest";
import { fromZonedTime } from "date-fns-tz";
import {
  getShopToday,
  getShopStatus,
  isShopAvailable,
  millisecondsUntilMidnight,
  periodStarts,
  shiftDay,
} from "@/lib/time";
import { demoShop } from "@/lib/demo";
import type { Hours } from "@/lib/types";

const tz = "Asia/Kuala_Lumpur";
const at = (time: string) => fromZonedTime(time, tz);
// Fixed Monday–Saturday 10–9 schedule with a lunch break, independent of the demo data.
const schedule: Hours[] = Array.from({ length: 7 }, (_, day) => ({
  day_of_week: day,
  is_open: day < 6,
  open_time: "10:00",
  close_time: "21:00",
  break_start: "13:00",
  break_end: "14:00",
}));
describe("business dates", () => {
  it("11:59 PM and 12:01 AM have different business dates", () => {
    expect(getShopToday(tz, at("2026-10-22T23:59:00"))).toBe("2026-10-22");
    expect(getShopToday(tz, at("2026-10-23T00:01:00"))).toBe("2026-10-23");
  });
  it("UTC server at 16:30 still sees tomorrow in Malaysia", () => {
    const original = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      expect(getShopToday(tz, new Date("2026-10-22T16:30:00Z"))).toBe("2026-10-23");
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
  it("also works when the host timezone is behind UTC", () => {
    const original = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      expect(getShopToday(tz, new Date("2026-10-22T16:30:00Z"))).toBe("2026-10-23");
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
  it("uses local midnight, including daylight saving transitions", () => {
    expect(millisecondsUntilMidnight(tz, at("2026-10-22T23:59:00"))).toBe(60000);
    expect(millisecondsUntilMidnight("America/New_York", new Date("2026-03-08T05:00:00Z"))).toBe(
      23 * 60 * 60 * 1000,
    );
    expect(millisecondsUntilMidnight("America/New_York", new Date("2026-11-01T04:00:00Z"))).toBe(
      25 * 60 * 60 * 1000,
    );
  });
  it("keeps week/month boundaries correct at a year boundary", () => {
    expect(periodStarts("2026-01-01")).toEqual({ week: "2025-12-29", month: "2026-01-01" });
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });
});
describe("shop status", () => {
  it("before opening", () =>
    expect(getShopStatus(demoShop, schedule, at("2026-10-22T09:59:00"))).toEqual({
      kind: "closed",
      label: "Closed · Opens today at 10:00 AM",
    }));
  it("at opening", () =>
    expect(getShopStatus(demoShop, schedule, at("2026-10-22T10:00:00")).kind).toBe("open"));
  it("during opening hours", () =>
    expect(getShopStatus(demoShop, schedule, at("2026-10-22T15:00:00"))).toEqual({
      kind: "open",
      label: "Open now · Closes 9:00 PM",
    }));
  it("before a break shows the next closing", () =>
    expect(getShopStatus(demoShop, schedule, at("2026-10-22T12:59:00")).label).toBe(
      "Open now · Closes 1:00 PM",
    ));
  it("at and during a break", () => {
    expect(getShopStatus(demoShop, schedule, at("2026-10-22T13:00:00"))).toEqual({
      kind: "closed",
      label: "On a break · Back at 2:00 PM",
    });
    expect(getShopStatus(demoShop, schedule, at("2026-10-22T13:30:00")).kind).toBe("closed");
  });
  it("at break end reopens", () =>
    expect(getShopStatus(demoShop, schedule, at("2026-10-22T14:00:00")).kind).toBe("open"));
  it("at and after closing", () => {
    expect(getShopStatus(demoShop, schedule, at("2026-10-22T21:00:00")).label).toBe(
      "Closed · Opens tomorrow at 10:00 AM",
    );
    expect(getShopStatus(demoShop, schedule, at("2026-10-22T23:00:00")).kind).toBe("closed");
  });
  it("a closed Sunday finds Monday", () =>
    expect(getShopStatus(demoShop, schedule, at("2026-10-25T12:00:00")).label).toBe(
      "Closed · Opens tomorrow at 10:00 AM",
    ));
  it("looks across a closed day", () =>
    expect(getShopStatus(demoShop, schedule, at("2026-10-24T22:00:00")).label).toBe(
      "Closed · Opens Mon, 26 Oct at 10:00 AM",
    ));
  it("all days closed", () =>
    expect(
      getShopStatus(
        demoShop,
        schedule.map((day) => ({ ...day, is_open: false })),
        at("2026-10-22T12:00:00"),
      ).label,
    ).toBe("Closed · Opening hours to be announced"));
  it("looks a full week ahead if only today is open", () =>
    expect(
      getShopStatus(
        demoShop,
        schedule.map((day) => ({ ...day, is_open: day.day_of_week === 3 })),
        at("2026-10-22T22:00:00"),
      ).label,
    ).toBe("Closed · Opens Thu, 29 Oct at 10:00 AM"));
  it("away mode overrides an otherwise open day", () =>
    expect(
      getShopStatus(
        { ...demoShop, is_available: false, unavailable_note: "On holiday" },
        schedule,
        at("2026-10-22T15:00:00"),
      ),
    ).toEqual({ kind: "away", label: "Not available until further notice", note: "On holiday" }));
  it("future back-on date is displayed", () =>
    expect(
      getShopStatus(
        { ...demoShop, is_available: false, unavailable_until: "2026-11-03" },
        schedule,
        at("2026-10-22T15:00:00"),
      ).label,
    ).toBe("Not available until Tue, 3 Nov"));
  it("past back-on date restores schedule", () =>
    expect(
      getShopStatus(
        { ...demoShop, is_available: false, unavailable_until: "2026-10-21" },
        schedule,
        at("2026-10-22T15:00:00"),
      ).kind,
    ).toBe("open"));
  it("becomes available exactly at midnight on back-on date", () => {
    const shop = { ...demoShop, is_available: false, unavailable_until: "2026-10-23" };
    expect(isShopAvailable(shop, at("2026-10-22T23:59:59"))).toBe(false);
    expect(isShopAvailable(shop, at("2026-10-23T00:00:00"))).toBe(true);
  });
});
