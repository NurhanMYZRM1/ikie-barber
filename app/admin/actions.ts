"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { availabilitySchema, hoursSchema, validationFields } from "@/lib/validation";
import { getShopToday } from "@/lib/time";
import type { ActionResult } from "@/lib/types";

// Server actions use the owner's session/publishable key; no service-role bypass.
export async function saveHours(input: unknown): Promise<ActionResult> {
  const db = await requireOwner();
  const parsed = hoursSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Check the highlighted times.",
      fields: validationFields(parsed.error),
    };
  const { error } = await db.from("weekly_hours").upsert(parsed.data);
  if (error?.message.includes("Resolve affected bookings"))
    return { ok: false, message: "Resolve affected bookings before changing these hours." };
  if (error) return { ok: false, message: "Couldn’t save hours. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Opening hours saved." };
}
export async function saveAvailability(input: unknown): Promise<ActionResult> {
  const db = await requireOwner();
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Check your return date and note.",
      fields: validationFields(parsed.error),
    };
  const { data: shop, error: shopError } = await db
    .from("shop_settings")
    .select("timezone")
    .eq("id", 1)
    .single();
  if (shopError) return { ok: false, message: "Couldn’t load the shop timezone. Try again." };
  if (
    !parsed.data.is_available &&
    parsed.data.unavailable_until &&
    parsed.data.unavailable_until <= getShopToday(shop.timezone)
  )
    return {
      ok: false,
      message: "Choose a future return date, or leave it blank.",
      fields: { unavailable_until: "Choose a date after today." },
    };
  const { error } = await db.from("shop_settings").update(parsed.data).eq("id", 1);
  if (error) return { ok: false, message: "Couldn’t update availability. Please try again." };
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: parsed.data.is_available ? "Your shop is available." : "Away mode is on.",
  };
}
export async function deleteBooking(id: unknown): Promise<ActionResult> {
  const db = await requireOwner();
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid booking." };
  const { error } = await db.from("bookings").delete().eq("id", id);
  if (error) return { ok: false, message: "Couldn’t cancel the booking. Try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Booking cancelled." };
}
export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("Could not sign out. Please try again.");
  redirect("/admin/login");
}
