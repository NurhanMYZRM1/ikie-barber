// Plain data shapes match the SQL columns; keeping names consistent helps beginners.
export type Shop = {
  id: number;
  name: string;
  description: string;
  address: string;
  maps_url: string;
  whatsapp_number: string;
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
export const AREAS = ["Shop", "Putrajaya", "Cyberjaya", "Bangi"] as const;
export type Booking = {
  id: string;
  slot_start: string;
  name: string;
  phone: string;
  area: (typeof AREAS)[number];
  address: string | null;
  note: string | null;
  created_at: string;
};
export type DailyTotal = { business_date: string; total: number; entry_count: number };
export type ActionResult = { ok: boolean; message: string; fields?: Record<string, string> };
