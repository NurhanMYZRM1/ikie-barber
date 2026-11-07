import type { Shop, Hours, Catalog } from "./types";

// Read-only public sample, used ONLY when connection environment variables are absent.
// A configured but broken database throws an error instead of pretending to work.
export const demoShop: Shop = {
  id: 1,
  name: "Ikie Barber",
  description: "",
  address: "Kuala Lumpur, Malaysia",
  maps_url: "",
  whatsapp_number: "601157878404",
  instagram_url: "https://www.instagram.com/ikiekentang_/",
  logo_url: "",
  timezone: "Asia/Kuala_Lumpur",
  currency: "MYR",
  is_available: true,
  unavailable_until: null,
  unavailable_note: null,
};
export const demoHours: Hours[] = Array.from({ length: 7 }, (_, day) => ({
  day_of_week: day,
  is_open: true,
  open_time: "15:00",
  close_time: "00:00",
  break_start: "18:30",
  break_end: "20:00",
}));
// The same price list the services migration seeds.
const areas = ["Putrajaya", "Cyberjaya", "Bangi"].map((name, index) => ({
  id: `30000000-0000-4000-8000-00000000000${index + 1}`,
  name,
  is_active: true,
  sort_order: index,
}));
const areaPrices = Object.fromEntries(areas.map((area, index) => [area.id, [20, 25, 35][index]]));
export const demoCatalog: Catalog = {
  services: [
    ["Haircut", 8],
    ["Adult haircut", 10],
  ].map(([name, price], index) => ({
    id: `20000000-0000-4000-8000-00000000000${index + 1}`,
    name: name as string,
    description: "",
    duration_minutes: 30,
    shop_price: price as number,
    university_price: null,
    area_prices: areaPrices,
    is_active: true,
    sort_order: index,
  })),
  areas,
  extras: [
    ["Late night (after 12 am)", 5],
    ["Last minute / urgent", 10],
  ].map(([label, amount], index) => ({
    id: `60000000-0000-4000-8000-00000000000${index + 1}`,
    label: label as string,
    amount: amount as number,
    starts_from: null,
    notice_hours: null,
    is_active: true,
    sort_order: index,
  })),
  visits: [],
};
