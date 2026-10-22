"use server";
// Keep monetary mutations behind owner authorization and database RLS.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { earningSchema, validationFields } from "@/lib/validation";
import { getShopToday } from "@/lib/time";
import type { ActionResult } from "@/lib/types";

export async function saveEarning(input: unknown, editing: boolean): Promise<ActionResult> {
  const db = await requireOwner();
  const parsed = earningSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fields: validationFields(parsed.error),
    };
  const { id, amount, note, payment_method } = parsed.data;
  const values = { amount, note: note || null, payment_method: payment_method || null };
  if (editing) {
    // Never update business_date: an old entry belongs to its original day.
    const { data, error } = await db
      .from("earnings")
      .update(values)
      .eq("id", id)
      .select("id")
      .single();
    if (error || !data)
      return { ok: false, message: "Couldn’t update this entry. It may have been deleted." };
  } else {
    const { data: shop, error: shopError } = await db
      .from("shop_settings")
      .select("timezone")
      .eq("id", 1)
      .single();
    if (shopError)
      return { ok: false, message: "Couldn’t read the shop timezone. Please try again." };
    // The trigger verifies this date using database time. Supplying an ID makes a
    // retry after a dropped network response safe: it cannot double-count money.
    const { error } = await db
      .from("earnings")
      .insert({ id, ...values, business_date: getShopToday(shop.timezone) });
    if (error && error.code !== "23505")
      return { ok: false, message: "Couldn’t save the entry. Please try again." };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: editing ? "Entry updated." : "Earnings added." };
}
export async function deleteEarning(id: unknown): Promise<ActionResult> {
  const db = await requireOwner();
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid entry." };
  const { error } = await db.from("earnings").delete().eq("id", id);
  if (error) return { ok: false, message: "Couldn’t delete the entry. Try again." };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Entry deleted." };
}
