import { describe, expect, it } from "vitest";
import { hoursSchema, earningSchema, settingsSchema } from "@/lib/validation";
import { sumMoney, formatMoney } from "@/lib/money";
import { demoShop } from "@/lib/demo";

describe("server validation", () => {
  const earning = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    amount: "35.50",
    note: "Haircut",
    payment_method: "Cash",
  };
  it.each(["0", "-1", "1.999", "Infinity", "1e5", "999999999.99", ""])(
    "rejects invalid amount %s",
    (amount) => expect(earningSchema.safeParse({ ...earning, amount }).success).toBe(false),
  );
  it("accepts cents and optional fields", () =>
    expect(earningSchema.safeParse({ ...earning, note: "", payment_method: "" }).success).toBe(
      true,
    ));
  it("requires breaks to fall inside hours", () =>
    expect(
      hoursSchema.safeParse({
        day_of_week: 0,
        is_open: true,
        open_time: "10:00",
        close_time: "21:00",
        break_start: "09:00",
        break_end: "14:00",
      }).success,
    ).toBe(false));
  it("rejects script URLs and malformed timezone", () => {
    expect(settingsSchema.safeParse({ ...demoShop, maps_url: "javascript:alert(1)" }).success).toBe(
      false,
    );
    expect(settingsSchema.safeParse({ ...demoShop, timezone: "Somewhere/Invalid" }).success).toBe(
      false,
    );
  });
  it("formats ringgit and sums cents exactly", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(formatMoney(1234.5)).toBe("RM 1,234.50");
  });
});
