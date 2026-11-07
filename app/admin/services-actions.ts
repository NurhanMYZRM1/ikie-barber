"use server";
// Services, house-call areas and extra charges. Changes reach new bookings only: each
// booking keeps a copy of what was agreed.
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { areaSchema, chargeSchema, serviceSchema, validationFields } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

async function save(
  table: "services" | "house_call_areas" | "extra_charges",
  schema: z.ZodType<{ id: string }>,
  input: unknown,
  editing: boolean,
  saved: string,
): Promise<ActionResult> {
  const db = await requireOwner();
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fields: validationFields(parsed.error),
    };
  const { id, ...values } = parsed.data;
  // Insert vs update, so a stale form can never recreate a row under its old id.
  const { error } = editing
    ? await db.from(table).update(values).eq("id", id)
    : await db.from(table).insert({ id, ...values });
  if (error?.code === "23505" && error.message.includes("name_key"))
    return {
      ok: false,
      message: "You already have an area with that name.",
      fields: { name: "Choose another name." },
    };
  // Same id already saved: an insert whose response was lost.
  if (error && !(error.code === "23505" && !editing))
    return { ok: false, message: "Couldn’t save. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: saved };
}
export async function saveService(input: unknown, editing: boolean) {
  return save("services", serviceSchema, input, editing, "Service saved.");
}
export async function saveArea(input: unknown, editing: boolean) {
  return save("house_call_areas", areaSchema, input, editing, "Area saved.");
}
export async function saveCharge(input: unknown, editing: boolean) {
  return save("extra_charges", chargeSchema, input, editing, "Charge saved.");
}
