"use server";
// Public booking: runs as the anon role. RLS lets visitors insert, never read details.
import { revalidatePath } from "next/cache";
import { formatInTimeZone } from "date-fns-tz";
import { getPublicShop } from "@/lib/data";
import { createPublicClient } from "@/lib/supabase/public";
import { getPreferredTimes } from "@/lib/time";
import { bookingSchema, validationFields } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

export type BookingResult = ActionResult & { address?: string; maps_url?: string };

export async function bookSlot(input: unknown): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fields: validationFields(parsed.error),
    };
  const { shop, hours, preview } = await getPublicShop();
  if (preview) return { ok: false, message: "Booking is off in the sample preview." };
  const booking = parsed.data;
  const day = formatInTimeZone(new Date(booking.slot_start), shop.timezone, "yyyy-MM-dd");
  // Only real open slots (hours, breaks, away mode). Taken slots are left to the
  // database, so a retry of this same booking can still be recognised below.
  const slot = getPreferredTimes(shop, hours, day, new Date()).find(
    (time) => new Date(time.start).getTime() === new Date(booking.slot_start).getTime(),
  );
  if (!slot) return { ok: false, message: "That time isn’t available. Choose another." };
  const { error } = await createPublicClient()
    .from("bookings")
    .insert({
      ...booking,
      slot_start: slot.start,
      address: booking.area === "Shop" ? null : booking.address,
      note: booking.note || null,
    });
  // Same id already saved: the first try worked but its response was lost.
  const retried = error?.code === "23505" && error.message.includes("bookings_pkey");
  // Otherwise the unique slot_start constraint settles two people booking at once.
  if (error?.code === "23505" && !retried) {
    revalidatePath("/"); // Refresh booked times so the taken slot shows crossed out at once.
    return { ok: false, message: "That time was just booked. Choose another." };
  }
  if (error && !retried)
    return { ok: false, message: "Couldn’t save your booking. Please try again." };
  revalidatePath("/");
  // Directions only for shop visits; a house-call customer is never sent to the shop.
  if (booking.area !== "Shop") return { ok: true, message: "You’re booked." };
  // The database gives the address only to the holder of this saved booking. If the
  // lookup fails the customer still sees "I’ll send you the location on WhatsApp."
  const { data } = await createPublicClient().rpc("booking_directions", {
    booking_id: booking.id,
  });
  const place = data?.[0];
  return {
    ok: true,
    message: "You’re booked.",
    address: place?.address ?? "",
    maps_url: place?.maps_url ?? "",
  };
}
