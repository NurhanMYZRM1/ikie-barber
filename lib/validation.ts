import { z } from "zod";
import { isTimezone } from "./time";

// Shared validation gives friendly form errors, and server actions run it again.
const quarter = z
  .string()
  .regex(/^([01]\d|2[0-3]):(00|15|30|45)$/, "Choose a time in 15-minute steps.");
export const hoursSchema = z
  .object({
    day_of_week: z.number().int().min(0).max(6),
    is_open: z.boolean(),
    open_time: quarter,
    close_time: quarter,
    break_start: quarter.nullable(),
    break_end: quarter.nullable(),
  })
  .superRefine((row, ctx) => {
    // 00:00 closing means midnight (end of day); overnight hours are not supported.
    const close = row.close_time === "00:00" ? "24:00" : row.close_time;
    if (close <= row.open_time)
      ctx.addIssue({
        code: "custom",
        path: ["close_time"],
        message: "Closing time must be after opening time.",
      });
    if (
      Boolean(row.break_start) !== Boolean(row.break_end) ||
      (row.break_start &&
        row.break_end &&
        (row.break_start <= row.open_time ||
          row.break_end >= close ||
          row.break_end <= row.break_start))
    )
      ctx.addIssue({
        code: "custom",
        path: ["break_end"],
        message: "The break must start and end inside opening hours.",
      });
  });
export const availabilitySchema = z.object({
  is_available: z.boolean(),
  unavailable_until: z.iso.date().nullable(),
  unavailable_note: z.string().trim().max(140).nullable(),
});
const money = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter an amount with up to 2 decimal places.")
  .transform(Number);
export const earningSchema = z.object({
  id: z.uuid(),
  amount: money.refine((n) => n > 0, "Enter an amount greater than zero."),
  note: z.string().trim().max(200),
  payment_method: z.enum(["Cash", "QR", "Card", ""]),
});
// Accept local formats like 011-5787 8404 and store digits with the country code.
const phone = z
  .string()
  .transform((value) => value.replace(/[\s()+-]/g, "").replace(/^0/, "60"))
  .pipe(z.string().regex(/^[1-9]\d{6,14}$/, "Enter your WhatsApp number, e.g. 0123456789."));
// Ids say what was chosen; the database works out the length, price and place from them.
export const bookingSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(["shop", "house_call", "university"]),
    slot_start: z.iso.datetime({ offset: true }),
    service_id: z.uuid(),
    area_id: z.uuid().nullable(),
    visit_id: z.uuid().nullable(),
    // The total the customer was shown and agreed to.
    total: z.number().nonnegative(),
    name: z.string().trim().min(1, "Enter your name.").max(60),
    phone,
    address: z.string().trim().max(300),
    note: z.string().trim().max(200),
  })
  .superRefine((booking, ctx) => {
    if (booking.kind === "house_call" && !booking.address)
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "Enter your address for the house call.",
      });
    if ((booking.kind === "house_call") !== Boolean(booking.area_id))
      ctx.addIssue({ code: "custom", path: ["area_id"], message: "Choose where." });
    if ((booking.kind === "university") !== Boolean(booking.visit_id))
      ctx.addIssue({ code: "custom", path: ["visit_id"], message: "Choose a visit." });
  });
const optionalUrl = z.union([
  z.literal(""),
  z.url().refine((value) => value.startsWith("https://"), "Use a secure https:// link."),
]);
export const settingsSchema = z.object({
  name: z.string().trim().min(1, "Enter your shop name.").max(80),
  description: z.string().trim().max(300),
  address: z.string().trim().max(300),
  maps_url: optionalUrl,
  logo_url: optionalUrl,
  instagram_url: optionalUrl,
  whatsapp_number: z
    .string()
    .regex(/^$|^[1-9]\d{6,14}$/, "Use country code and digits only, e.g. 60123456789."),
  timezone: z.string().refine(isTimezone, "Choose a valid IANA timezone, e.g. Asia/Kuala_Lumpur."),
  currency: z.enum(["MYR", "SGD", "USD", "GBP", "EUR", "AUD"]),
});
// Blank means "not offered here", which is different from free.
const price = z
  .string()
  .trim()
  .regex(/^$|^\d{1,8}(\.\d{1,2})?$/, "Enter an amount with up to 2 decimal places.")
  .transform((value) => (value === "" ? null : Number(value)));
const order = z.number().int().min(0).max(10000);
export const serviceSchema = z.object({
  id: z.uuid(),
  sort_order: order,
  name: z.string().trim().min(1, "Enter a name.").max(80),
  description: z.string().trim().max(200),
  duration_minutes: z.coerce
    .number()
    .int("Enter 5 to 480 minutes.")
    .min(5, "Enter 5 to 480 minutes.")
    .max(480, "Enter 5 to 480 minutes."),
  is_active: z.boolean(),
  shop_price: price,
  university_price: price,
  area_prices: z
    .record(z.uuid(), price)
    .transform((prices) =>
      Object.fromEntries(Object.entries(prices).filter(([, value]) => value !== null)),
    ),
});
export const areaSchema = z.object({
  id: z.uuid(),
  sort_order: order,
  name: z.string().trim().min(1, "Enter an area name.").max(60),
  is_active: z.boolean(),
});
export const chargeSchema = z
  .object({
    id: z.uuid(),
    sort_order: order,
    label: z.string().trim().min(1, "Enter a label.").max(80),
    amount: money.refine((n) => n > 0, "Enter an amount greater than zero."),
    rule: z.enum(["none", "from", "notice"]),
    starts_from: z.string(),
    notice_hours: z.string(),
    is_active: z.boolean(),
  })
  .superRefine((charge, ctx) => {
    if (
      charge.rule === "from" &&
      (!/^([01]\d|2[0-3]):(00|15|30|45)$/.test(charge.starts_from) ||
        charge.starts_from === "00:00")
    )
      ctx.addIssue({
        code: "custom",
        path: ["starts_from"],
        message: "Choose a time after 12:00 AM, in 15-minute steps.",
      });
    if (charge.rule === "notice" && !/^([1-9]\d?|1[0-5]\d|16[0-8])$/.test(charge.notice_hours))
      ctx.addIssue({ code: "custom", path: ["notice_hours"], message: "Enter 1 to 168 hours." });
  })
  .transform(({ rule, starts_from, notice_hours, ...charge }) => ({
    ...charge,
    starts_from: rule === "from" ? starts_from : null,
    notice_hours: rule === "notice" ? Number(notice_hours) : null,
  }));
const halfHour = z
  .string()
  .regex(/^([01]\d|2[0-3]):(00|30)$/, "Choose a time on the hour or half hour.");
const buffer = z.coerce
  .number()
  .int("Enter 0 to 240 minutes.")
  .min(0, "Enter 0 to 240 minutes.")
  .max(240, "Enter 0 to 240 minutes.");
export const visitSchema = z
  .object({
    id: z.uuid(),
    date: z.iso.date("Choose a date."),
    start: halfHour,
    end: halfHour,
    buffer_before: buffer,
    buffer_after: buffer,
    is_open: z.boolean(),
    // Chosen services and their visit prices; blank uses the service's uni price.
    services: z.record(z.uuid(), price),
  })
  .superRefine((visit, ctx) => {
    if (visit.end <= visit.start)
      ctx.addIssue({ code: "custom", path: ["end"], message: "End the visit after it starts." });
    if (!Object.keys(visit.services).length)
      ctx.addIssue({ code: "custom", path: ["services"], message: "Choose at least one service." });
  });
export function validationFields(error: z.ZodError) {
  return Object.fromEntries(error.issues.map((issue) => [issue.path[0] as string, issue.message]));
}
