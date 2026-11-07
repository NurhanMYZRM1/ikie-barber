// Plain data shapes match the SQL columns; keeping names consistent helps beginners.
export type Shop = {
  id: number;
  name: string;
  description: string;
  address: string;
  maps_url: string;
  whatsapp_number: string;
  instagram_url: string;
  logo_url: string;
  timezone: string;
  currency: string;
  is_available: boolean;
  unavailable_until: string | null;
  unavailable_note: string | null;
};
// What visitors may see: the address and map link are only given out after booking.
export type PublicShop = Omit<Shop, "address" | "maps_url">;
export type Hours = {
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  break_start: string | null;
  break_end: string | null;
};
export type Earning = {
  id: string;
  amount: number;
  note: string | null;
  payment_method: "Cash" | "QR" | "Card" | null;
  business_date: string;
  created_at: string;
};
export type Service = {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  // A blank price means the service isn't offered there.
  shop_price: number | null;
  university_price: number | null;
  area_prices: Record<string, number>;
  is_active: boolean;
  sort_order: number;
};
export type Area = { id: string; name: string; is_active: boolean; sort_order: number };
export type ExtraCharge = {
  id: string;
  label: string;
  amount: number;
  // At most one rule; with none the charge is listed and arranged on WhatsApp.
  starts_from: string | null;
  notice_hours: number | null;
  is_active: boolean;
  sort_order: number;
};
// University visits expose scheduling and pricing only. Locations are agreed on WhatsApp.
export type PublicVisit = {
  id: string;
  reserved_from: string;
  starts_at: string;
  ends_at: string;
  reserved_until: string;
  // Service id to the visit's own price, or null for the service's uni price.
  services: Record<string, number | null>;
  is_open: boolean;
};
export type Visit = PublicVisit;
export type Catalog = {
  services: Service[];
  areas: Area[];
  extras: ExtraCharge[];
  visits: PublicVisit[];
};
export type Busy = { slot_start: string; slot_end: string };
export type BookingKind = "shop" | "house_call" | "university";
export type Charge = { label: string; amount: number };
export type Booking = {
  id: string;
  slot_start: string;
  slot_end: string;
  kind: BookingKind;
  name: string;
  phone: string;
  area: string | null;
  address: string | null;
  note: string | null;
  visit_id: string | null;
  // What was agreed when booking. Bookings made before services existed have none.
  service_name: string | null;
  price: number | null;
  charges: Charge[] | null;
  total: number | null;
  meeting_area: string | null;
  meeting_point: string | null;
  map_url: string | null;
  created_at: string;
};
export type DailyTotal = { business_date: string; total: number; entry_count: number };
export type ActionResult = { ok: boolean; message: string; fields?: Record<string, string> };
