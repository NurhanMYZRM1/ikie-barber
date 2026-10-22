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
  if (error) return { ok: false, message: "Couldn’t save your shop details. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Shop details saved." };
}
