"use server";
// Uni visits. The database keeps visits, their travel/setup buffers and bookings from
// overlapping; these actions also list what clashes so the owner can resolve it.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { requireOwner } from "@/lib/auth";
import { validationFields, visitSchema } from "@/lib/validation";
import type { ActionResult, BookingKind } from "@/lib/types";

export type Clash = { kind: BookingKind | "visit"; start: string; end: string; name: string };
export type VisitResult = ActionResult & { clashes?: Clash[] };
const minutes = (date: Date, count: number) => new Date(date.getTime() + count * 60_000);

export async function saveVisit(input: unknown, editing: boolean): Promise<VisitResult> {
  const db = await requireOwner();
  const parsed = visitSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fields: validationFields(parsed.error),
    };
  const visit = parsed.data;
  const [shop, services] = await Promise.all([
    db.from("shop_settings").select("timezone,whatsapp_number").eq("id", 1).single(),
    db.from("services").select("id,university_price"),
  ]);
  if (shop.error || services.error)
    return { ok: false, message: "Couldn’t load the shop timezone. Try again." };
  if (visit.is_open && !shop.data.whatsapp_number)
    return {
      ok: false,
      message: "Add your WhatsApp number in Settings before opening a visit.",
      fields: { is_open: "Customers confirm their meeting point with you on WhatsApp." },
    };
  // Every offered service needs a price: the visit's own, or the service's uni price.
  if (
    Object.entries(visit.services).some(
      ([id, price]) =>
        price === null &&
        services.data.find((service) => service.id === id)?.university_price == null,
    )
  )
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fields: { services: "Give each chosen service a price." },
    };
  const starts = fromZonedTime(`${visit.date}T${visit.start}:00`, shop.data.timezone);
  const ends = fromZonedTime(`${visit.date}T${visit.end}:00`, shop.data.timezone);
  if (!editing && starts <= new Date())
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fields: { date: "Choose a future date and time." },
    };
  const row = {
    reserved_from: minutes(starts, -visit.buffer_before).toISOString(),
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    reserved_until: minutes(ends, visit.buffer_after).toISOString(),
    services: visit.services,
    is_open: visit.is_open,
  };

  // Other appointments inside the reserved window, this visit's own bookings outside its
  // new hours, and other visits whose windows overlap.
  const [inside, own, visits] = await Promise.all([
    db
      .from("bookings")
      .select("slot_start,slot_end,name,kind,visit_id")
      .lt("slot_start", row.reserved_until)
      .gt("slot_end", row.reserved_from),
    db.from("bookings").select("slot_start,slot_end,name,kind").eq("visit_id", visit.id),
    db
      .from("university_visits")
      .select("id,starts_at,ends_at")
      .lt("reserved_from", row.reserved_until)
      .gt("reserved_until", row.reserved_from),
  ]);
  if (inside.error || own.error || visits.error)
    return { ok: false, message: "Couldn’t save the visit. Please try again." };
  const clashes: Clash[] = [
    ...inside.data.filter((booking) => booking.visit_id !== visit.id),
    ...own.data.filter(
      (booking) => new Date(booking.slot_start) < starts || new Date(booking.slot_end) > ends,
    ),
  ].map((booking) => ({
    kind: booking.kind,
    start: booking.slot_start,
    end: booking.slot_end,
    name: booking.name,
  }));
  for (const other of visits.data.filter((item) => item.id !== visit.id))
    clashes.push({
      kind: "visit",
      start: other.starts_at,
      end: other.ends_at,
      name: "Uni visit",
    });
  if (clashes.length)
    return { ok: false, message: "This visit clashes with other appointments.", clashes };

  const { error } = editing
    ? await db.from("university_visits").update(row).eq("id", visit.id)
    : await db
        .from("university_visits")
        .insert({ id: visit.id, area_label: "University visit", ...row });
  // Something was booked between the check above and this save.
  if (error?.code === "23P01" || error?.message.includes("clashes"))
    return { ok: false, message: "This visit clashes with other appointments." };
  if (error && !(error.code === "23505" && !editing))
    return { ok: false, message: "Couldn’t save the visit. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Visit saved." };
}

// Pausing stops new bookings; existing ones stay booked.
export async function setVisitOpen(id: unknown, open: unknown): Promise<ActionResult> {
  const db = await requireOwner();
  if (!z.uuid().safeParse(id).success || typeof open !== "boolean")
    return { ok: false, message: "Invalid visit." };
  const { error } = await db.from("university_visits").update({ is_open: open }).eq("id", id);
  if (error?.message.includes("WhatsApp"))
    return { ok: false, message: "Add your WhatsApp number in Settings before opening a visit." };
  if (error) return { ok: false, message: "Couldn’t update the visit. Try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: open ? "Visit open for bookings." : "Visit paused." };
}

// Only a visit without bookings can go: the owner resolves each booking first.
export async function deleteVisit(id: unknown): Promise<ActionResult> {
  const db = await requireOwner();
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid visit." };
  const { error } = await db.from("university_visits").delete().eq("id", id);
  if (error?.code === "23503") return { ok: false, message: "Cancel this visit’s bookings first." };
  if (error) return { ok: false, message: "Couldn’t cancel the visit. Try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Visit cancelled." };
}
