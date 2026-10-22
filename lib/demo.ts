import type { Shop, Hours } from "./types";

// Read-only public sample, used ONLY when connection environment variables are absent.
// A configured but broken database throws an error instead of pretending to work.
export const demoShop: Shop = {
  id: 1,
  name: "Ikie Barber",
  description: "",
  address: "Kuala Lumpur, Malaysia",
  maps_url: "",
  whatsapp_number: "601157878404",
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
