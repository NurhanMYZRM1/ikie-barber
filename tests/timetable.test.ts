import { describe, expect, it } from "vitest";
import { fromZonedTime } from "date-fns-tz";
import { demoHours, demoShop } from "@/lib/demo";
import { getPreferredTimes, getShopStatus } from "@/lib/time";

const at = (time: string) => fromZonedTime(time, demoShop.timezone);
const day = "2026-10-22";
const beforeOpening = at(`${day}T09:00:00`);
const labels = (times: { label: string }[]) => times.map((time) => time.label);

describe("customer timetable", () => {
  it("offers the shop's 30-minute slots, skipping the break, up to midnight", () => {
    const times = getPreferredTimes(demoShop, demoHours, day, beforeOpening);
    expect(labels(times)).toEqual([
      "3:00 PM",
      "3:30 PM",
      "4:00 PM",
      "4:30 PM",
      "5:00 PM",
      "5:30 PM",
      "6:00 PM",
      "8:00 PM",
      "8:30 PM",
      "9:00 PM",
      "9:30 PM",
      "10:00 PM",
      "10:30 PM",
      "11:00 PM",
      "11:30 PM",
    ]);
    expect(times[0]).toEqual({
      start: at(`${day}T15:00:00`).toISOString(),
      label: "3:00 PM",
      booked: false,
    });
  });
  it("flags booked slots instead of hiding them", () => {
    const booked = [at(`${day}T16:00:00`).toISOString()];
    const times = getPreferredTimes(demoShop, demoHours, day, beforeOpening, booked);
    expect(times.filter((time) => time.booked).map((time) => time.label)).toEqual(["4:00 PM"]);
    expect(times).toHaveLength(15);
  });
  it("omits elapsed times using the shop timezone", () => {
    const times = getPreferredTimes(demoShop, demoHours, day, at(`${day}T15:15:00`));
    expect(times[0].label).toBe("3:30 PM");
  });
  it("does not offer past dates, closed days or invalid dates", () => {
    const sundayClosed = demoHours.map((row) => ({ ...row, is_open: row.day_of_week !== 6 }));
    for (const value of ["2026-10-21", "2026-10-25", "2026-02-30", "invalid"]) {
      expect(getPreferredTimes(demoShop, sundayClosed, value, beforeOpening)).toEqual([]);
    }
  });
  it("hides slots during away mode and resumes when it expires", () => {
    expect(
      getPreferredTimes({ ...demoShop, is_available: false }, demoHours, day, beforeOpening),
    ).toEqual([]);
    expect(
      getPreferredTimes(
        { ...demoShop, is_available: false, unavailable_until: "2026-10-21" },
        demoHours,
        day,
        beforeOpening,
      ),
    ).toHaveLength(15);
  });
  it("treats a 00:00 closing time as open until midnight", () => {
    expect(getShopStatus(demoShop, demoHours, at(`${day}T23:50:00`)).label).toBe(
      "Open now · Closes 12:00 AM",
    );
  });
});
