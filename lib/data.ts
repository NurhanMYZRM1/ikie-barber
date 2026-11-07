import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { isConfigured } from "@/lib/supabase/config";
import { requireOwner } from "./auth";
import { demoShop, demoHours, demoCatalog } from "./demo";
import type {
  Shop,
  PublicShop,
  Hours,
  Earning,
  DailyTotal,
  Booking,
  Busy,
  Catalog,
  Visit,
} from "./types";

// Matches the columns visitors are granted; the address and map link are not among them.
const PUBLIC_SHOP =
  "id,name,description,whatsapp_number,instagram_url,logo_url,timezone,currency,is_available,unavailable_until,unavailable_note";

// Public reads contain no financial queries. RLS independently enforces this split.
export const getPublicShop = cache(async () => {
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
});
// University browsing never includes locations; customers confirm them with the owner.
const PUBLIC_VISIT = "id,reserved_from,starts_at,ends_at,reserved_until,services,is_open";

// Services, prices, areas, extras and upcoming visits: what the booking pages need.
// RLS hides inactive services, areas and charges from visitors.
export const getCatalog = cache(async (): Promise<Catalog> => {
  if (!isConfigured()) return demoCatalog;
  const db = createPublicClient();
  const [services, areas, extras, visits] = await Promise.all([
    db.from("services").select("*").order("sort_order").order("name"),
    db.from("house_call_areas").select("*").order("sort_order").order("name"),
    db.from("extra_charges").select("*").order("sort_order").order("label"),
    db
      .from("university_visits")
      .select(PUBLIC_VISIT)
      .gt("reserved_until", new Date().toISOString())
      .order("starts_at"),
  ]);
  if (services.error || areas.error || extras.error || visits.error)
    throw new Error("Unable to load services and prices.");
  return {
    services: services.data,
    areas: areas.data,
    extras: extras.data,
    visits: visits.data,
  } as Catalog;
});
// Visitors can read booked times only; the column grant hides who booked.
export async function getBusy(): Promise<Busy[]> {
  if (!isConfigured()) return [];
  const db = createPublicClient();
  const busy: Busy[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from("bookings")
      .select("slot_start,slot_end")
      .gt("slot_end", new Date().toISOString())
      .order("slot_start")
      .range(offset, offset + 499);
    if (error) throw new Error("Unable to load booked times.");
    busy.push(...(data as Busy[]));
    if (data.length < 500) break;
  }
  return busy;
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
// Everything the owner manages, including hidden services and paused visits.
export async function getOwnerCatalog() {
  const db = await requireOwner();
  const [services, areas, extras, visits] = await Promise.all([
    db.from("services").select("*").order("sort_order").order("name"),
    db.from("house_call_areas").select("*").order("sort_order").order("name"),
    db.from("extra_charges").select("*").order("sort_order").order("label"),
    // shortcut: the latest 100 visits; past ones are kept only to duplicate them.
    db
      .from("university_visits")
      .select(PUBLIC_VISIT)
      .order("starts_at", { ascending: false })
      .limit(100),
  ]);
  if (services.error || areas.error || extras.error || visits.error)
    throw new Error("Could not load services and visits.");
  return {
    services: services.data,
    areas: areas.data,
    extras: extras.data,
    visits: visits.data as Visit[],
  } as Catalog & { visits: Visit[] };
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
