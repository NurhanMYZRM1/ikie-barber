"use server";
// Public booking: runs as the anon role. RLS lets visitors insert, never read details.
// The database checks hours, breaks, away mode, visits, overlaps and the agreed price.
import { revalidatePath } from "next/cache";
import { getPublicShop } from "@/lib/data";
import { createPublicClient } from "@/lib/supabase/public";
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
  const { preview } = await getPublicShop();
  if (preview) return { ok: false, message: "Booking is off in the sample preview." };
  const booking = parsed.data;
  const { error } = await createPublicClient()
    .from("bookings")
    .insert({
      ...booking,
      address: booking.kind === "house_call" ? booking.address : null,
      note: booking.note || null,
    });
  // Same id already saved: the first try worked but its response was lost. Start times
  // are no longer unique, so the booking id is the only unique value left.
  const retried = error?.code === "23505";
  if (error && !retried) {
    // Refresh booked times and prices, so the page shows what changed at once.
    revalidatePath("/", "layout");
    if (error.code === "23P01")
      return { ok: false, message: "That time was just booked. Choose another." };
    if (error.message.includes("Price changed"))
      return { ok: false, message: "Prices just changed. Check the new total, then book again." };
    if (error.message.includes("available service"))
      return { ok: false, message: "That haircut isn’t available there now. Choose another." };
    if (error.message.includes("available time"))
      return { ok: false, message: "That time isn’t available. Choose another." };
    return { ok: false, message: "Couldn’t save your booking. Please try again." };
  }
  revalidatePath("/", "layout");
  // Only shop bookings receive directions. Uni customers must agree on a location
  // directly with the owner, even if an older visit has stored location details.
  if (booking.kind !== "shop") return { ok: true, message: "You’re booked." };
  // The database gives directions only to the holder of this saved booking: the shop
  // address. If the lookup fails the customer
  // still sees what to do next.
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
