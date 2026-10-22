import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { isConfigured } from "@/lib/supabase/config";
import { requireOwner } from "./auth";
import { demoShop, demoHours } from "./demo";
import type { Shop, PublicShop, Hours, Earning, DailyTotal, Booking } from "./types";

// Matches the columns visitors are granted; the address and map link are not among them.
const PUBLIC_SHOP =
  "id,name,description,whatsapp_number,logo_url,timezone,currency,is_available,unavailable_until,unavailable_note";

// Public reads contain no financial queries. RLS independently enforces this split.
export async function getPublicShop() {
  if (!isConfigured()) {
    const { address: _address, maps_url: _maps, ...shop } = demoShop;
    return { shop: shop as PublicShop, hours: demoHours, preview: true };
  }
  const db = createPublicClient();
  const [shop, hours] = await Promise.all([
    db.from("shop_settings").select(PUBLIC_SHOP).eq("id", 1).single(),
    db.from("weekly_hours").select("*").order("day_of_week"),
  ]);
  if (shop.error || hours.error)
    throw new Error("Unable to load the shop. Check migrations and seed data.");
  return {
    shop: shop.data as PublicShop,
    hours: hours.data as Hours[],
    preview: false,
  };
}
// Visitors can read booked start times only; the column grant hides who booked.
export async function getBookedSlots(): Promise<string[]> {
  if (!isConfigured()) return [];
  const db = createPublicClient();
  const slots: string[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from("bookings")
      .select("slot_start")
      .gte("slot_start", new Date().toISOString())
      .order("slot_start")
      .range(offset, offset + 499);
    if (error) throw new Error("Unable to load booked times.");
    slots.push(...data.map((row) => row.slot_start as string));
    if (data.length < 500) break;
  }
  return slots;
}
export async function getUpcomingBookings(): Promise<Booking[]> {
  const db = await requireOwner();
  const { data, error } = await db
    .from("bookings")
    .select("*")
    .gte("slot_start", new Date(Date.now() - 2 * 3600_000).toISOString())
    .order("slot_start");
  if (error) throw new Error("Could not load bookings.");
  return data as Booking[];
}
export async function getBookings(): Promise<{ upcoming: Booking[]; past: Booking[] }> {
  const db = await requireOwner();
  const now = new Date().toISOString();
  const [upcoming, past] = await Promise.all([
    // At most 31 days of half-hour slots can be booked ahead, well under one response page.
    db.from("bookings").select("*").gte("slot_start", now).order("slot_start"),
    // shortcut: only the latest 200 past bookings; add paging if the owner needs older ones.
    db
      .from("bookings")
      .select("*")
      .lt("slot_start", now)
      .order("slot_start", { ascending: false })
      .limit(200),
  ]);
  if (upcoming.error || past.error) throw new Error("Could not load bookings.");
  return { upcoming: upcoming.data as Booking[], past: past.data as Booking[] };
}
export async function getOwnerShop() {
  const db = await requireOwner();
  const [shop, hours] = await Promise.all([
    db.from("shop_settings").select("*").eq("id", 1).single(),
    db.from("weekly_hours").select("*").order("day_of_week"),
  ]);
  if (shop.error || hours.error) throw new Error("Could not load shop settings.");
  return {
    shop: shop.data as Shop,
    hours: hours.data as Hours[],
  };
}
export async function getDayEntries(day: string): Promise<Earning[]> {
  const db = await requireOwner();
  const entries: Earning[] = [];
  // Supabase caps each response. Page explicitly so totals/lists never silently truncate.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from("earnings")
      .select("*")
      .eq("business_date", day)
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + 499);
    if (error) throw new Error("Could not load earnings.");
    entries.push(...(data as Earning[]));
    if (data.length < 500) break;
  }
  return entries;
}
export async function getDailyTotals(): Promise<DailyTotal[]> {
  const db = await requireOwner();
  const days: DailyTotal[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .rpc("daily_earnings_totals")
      .order("business_date", { ascending: false })
      .range(offset, offset + 499);
    if (error) throw new Error("Could not load earnings history.");
    days.push(...(data as DailyTotal[]));
    if (data.length < 500) break;
  }
  return days;
}
