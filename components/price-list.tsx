import { translate, type Lang } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { priceRange } from "@/lib/pricing";
import { timeLabel } from "@/lib/time";
import type { Catalog, ExtraCharge } from "@/lib/types";

// Prices come from Services & prices in the owner dashboard; the booking form reads the
// same catalogue. Service names and charge labels are the owner's own words.
const NOTES = [
  "Price includes full equipment",
  "Neat and professional service",
  "Book early to secure a slot",
  "Prices may vary for some locations",
];
type Props = { lang: Lang; catalog: Catalog; currency: string };
const range = (prices: (number | null | undefined)[], currency: string) => {
  const found = priceRange(prices);
  if (!found) return null;
  const money = (amount: number) => formatMoney(amount, currency);
  return found.min === found.max ? money(found.min) : `${money(found.min)}–${money(found.max)}`;
};
const houseCallPrices = (catalog: Catalog) =>
  catalog.services.flatMap((service) => catalog.areas.map((area) => service.area_prices[area.id]));
export function chargeRule(extra: ExtraCharge, lang: Lang) {
  if (extra.starts_from)
    return translate(lang, "For times from {time}", { time: timeLabel(extra.starts_from) });
  if (extra.notice_hours)
    return translate(lang, "When booked less than {count} hours ahead", {
      count: extra.notice_hours,
    });
  return translate(lang, "Arranged on WhatsApp");
}

// Two-line glance shown before the customer picks a slot; the full list sits beside it.
export function PriceSummary({
  lang,
  catalog,
  currency,
  className = "",
}: Props & { className?: string }) {
  const t = (text: string) => translate(lang, text);
  const shop = range(
    catalog.services.map((service) => service.shop_price),
    currency,
  );
  const house = range(houseCallPrices(catalog), currency);
  if (!shop && !house) return null;
  return (
    <dl className={`ticket grid gap-2 text-sm ${className}`}>
      {shop && (
        <div className="flex justify-between gap-4">
          <dt>{t("At the shop")}</dt>
          <dd className="font-semibold tabular-nums">{shop}</dd>
        </div>
      )}
      {house && (
        <div className="flex justify-between gap-4 border-t border-dashed border-line pt-2 first:border-0 first:pt-0">
          <dt>{t("House call")}</dt>
          <dd className="font-semibold tabular-nums">{house}</dd>
        </div>
      )}
    </dl>
  );
}

export function PriceList({ lang, catalog, currency }: Props) {
  const t = (text: string, vars?: Record<string, string | number>) => translate(lang, text, vars);
  const money = (amount: number) => formatMoney(amount, currency);
  const services = catalog.services.filter(
    (service) =>
      service.shop_price !== null ||
      catalog.areas.some((area) => service.area_prices[area.id] !== undefined),
  );
  return (
    <section
      id="prices"
      className="scroll-mt-6 border-t border-line py-8 sm:py-10 lg:border-t-0"
      aria-labelledby="prices-title"
    >
      <h2 id="prices-title" className="section-title mb-4">
        {t("Price list")}
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
        <div className="space-y-5">
          {services.map((service) => (
            <div key={service.id}>
              <h3 className="text-sm font-semibold">
                {service.name}{" "}
                <span className="font-normal text-muted">
                  · {t("{minutes} min", { minutes: service.duration_minutes })}
                </span>
              </h3>
              {service.description && (
                <p className="mt-1 text-xs text-muted">{service.description}</p>
              )}
              <dl className="mt-1 divide-y divide-dashed divide-line">
                {service.shop_price !== null && (
                  <div className="flex justify-between gap-4 py-3 text-sm">
                    <dt>{t("At the shop")}</dt>
                    <dd className="font-semibold tabular-nums">{money(service.shop_price)}</dd>
                  </div>
                )}
                {catalog.areas.map(
                  (area) =>
                    service.area_prices[area.id] !== undefined && (
                      <div key={area.id} className="flex justify-between gap-4 py-3 text-sm">
                        <dt>{t("{area} (house call)", { area: area.name })}</dt>
                        <dd className="font-semibold tabular-nums">
                          {money(service.area_prices[area.id])}
                        </dd>
                      </div>
                    ),
                )}
              </dl>
            </div>
          ))}
          {!services.length && (
            <p className="text-sm text-muted">{t("Prices will be shared soon.")}</p>
          )}
        </div>
        <div>
          {catalog.extras.length > 0 && (
            <>
              <h3 className="text-sm font-semibold">{t("Extra charges")}</h3>
              <dl className="mt-1 divide-y divide-dashed divide-line">
                {catalog.extras.map((extra) => (
                  <div key={extra.id} className="flex justify-between gap-4 py-3 text-sm">
                    <dt>
                      {extra.label}
                      <span className="block text-xs text-muted">{chargeRule(extra, lang)}</span>
                    </dt>
                    <dd className="font-semibold tabular-nums">+{money(extra.amount)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          <p className="mt-2 text-xs leading-5 text-muted text-pretty">
            {t("Online booking runs until midnight. For later times, ask on WhatsApp.")}
          </p>
          <ul className="mt-4 list-disc space-y-1 pl-4 text-sm text-muted">
            {NOTES.map((note) => (
              <li key={note}>{t(note)}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-6 text-xs leading-5 text-muted text-pretty">
        {t("The exact address is shared after you book.")}
      </p>
    </section>
  );
}
