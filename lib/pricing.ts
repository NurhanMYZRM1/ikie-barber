import { formatInTimeZone } from "date-fns-tz";
import { sumMoney } from "./money";
import type { Catalog, Charge, ExtraCharge, PublicVisit, Service } from "./types";

export function houseCallAreaNames(catalog: Catalog, lang: "en" | "ms") {
  const names = catalog.areas
    .filter(
      (area) =>
        area.is_active &&
        catalog.services.some(
          (service) => service.is_active && service.area_prices[area.id] !== undefined,
        ),
    )
    .map((area) => area.name);
  return new Intl.ListFormat(lang, { style: "long", type: "conjunction" }).format(names);
}

export type Place =
  | { kind: "shop" }
  | { kind: "house_call"; area_id: string }
  | { kind: "university"; visit: PublicVisit };
export type Quote = { price: number; charges: Charge[]; total: number };

// Null means the service isn't offered there: unpriced work is arranged on WhatsApp.
export function servicePrice(service: Service, place: Place): number | null {
  if (place.kind === "shop") return service.shop_price;
  if (place.kind === "house_call") return service.area_prices[place.area_id] ?? null;
  // A visit's own price wins over the service's uni price.
  if (!(service.id in place.visit.services)) return null;
  return place.visit.services[service.id] ?? service.university_price;
}

// Mirrors private.validate_booking, which recomputes this and rejects any other total.
// extras must keep the database order (sort_order, then label).
export function quote(
  service: Service,
  place: Place,
  extras: ExtraCharge[],
  slotStart: string,
  timezone: string,
  now = new Date(),
): Quote | null {
  const price = servicePrice(service, place);
  if (price === null) return null;
  const clock = formatInTimeZone(new Date(slotStart), timezone, "HH:mm");
  const lead = new Date(slotStart).getTime() - now.getTime();
  // shortcut: the notice rule uses this device's clock; a phone clock minutes off near the
  // cut-off gets a "prices changed" answer from the database until the cut-off passes.
  const charges = extras
    .filter(
      (extra) =>
        extra.is_active &&
        ((extra.starts_from !== null && clock >= extra.starts_from.slice(0, 5)) ||
          (extra.notice_hours !== null && lead < extra.notice_hours * 3_600_000)),
    )
    .map(({ label, amount }) => ({ label, amount }));
  return { price, charges, total: sumMoney([price, ...charges.map((charge) => charge.amount)]) };
}

// "RM8–RM10" style range across the given prices, or null when none are set.
export function priceRange(prices: (number | null | undefined)[]) {
  const set = prices.filter((price): price is number => typeof price === "number");
  return set.length ? { min: Math.min(...set), max: Math.max(...set) } : null;
}
