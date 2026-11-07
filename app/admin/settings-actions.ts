"use server";
// Validate every profile write on the server even when the browser already checked it.
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { settingsSchema, validationFields } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

export async function saveSettings(input: unknown): Promise<ActionResult> {
  const db = await requireOwner();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fields: validationFields(parsed.error),
    };
  const { error } = await db.from("shop_settings").update(parsed.data).eq("id", 1);
  if (error?.message.includes("before changing the timezone"))
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fields: { timezone: "Resolve upcoming bookings before changing the timezone." },
    };
  // Uni customers confirm their meeting point on WhatsApp; the database keeps the number.
  if (error?.message.includes("WhatsApp"))
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fields: { whatsapp_number: "Pause your open uni visits before removing this number." },
    };
  if (error) return { ok: false, message: "Couldn’t save your shop details. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Shop details saved." };
}
