import { z } from "zod";
import { isTimezone } from "./time";
import { AREAS } from "./types";

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
export const bookingSchema = z
  .object({
    id: z.uuid(),
    slot_start: z.iso.datetime({ offset: true }),
    name: z.string().trim().min(1, "Enter your name.").max(60),
    phone,
    area: z.enum(AREAS),
    address: z.string().trim().max(300),
    note: z.string().trim().max(200),
  })
  .superRefine((booking, ctx) => {
    if (booking.area !== "Shop" && !booking.address)
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "Enter your address for the house call.",
      });
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
  whatsapp_number: z
    .string()
    .regex(/^$|^[1-9]\d{6,14}$/, "Use country code and digits only, e.g. 60123456789."),
  timezone: z.string().refine(isTimezone, "Choose a valid IANA timezone, e.g. Asia/Kuala_Lumpur."),
  currency: z.enum(["MYR", "SGD", "USD", "GBP", "EUR", "AUD"]),
});
export function validationFields(error: z.ZodError) {
  return Object.fromEntries(error.issues.map((issue) => [issue.path[0] as string, issue.message]));
}
