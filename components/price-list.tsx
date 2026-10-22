import { translate, type Lang } from "@/lib/i18n";

// Prices from the shop's printed price list. Edit here to change them; the booking
// form's "Where" options read the same values.
export const PRICES = {
  base: "RM8",
  adult: "RM10",
  Putrajaya: "RM20",
  Cyberjaya: "RM25",
  Bangi: "RM35",
};
// [label, price, area]: the area fills {area} in the translated label.
const ROWS = [
  ["Base price", PRICES.base],
  ["Adult", PRICES.adult],
  ["{area} (house call)", PRICES.Putrajaya, "Putrajaya"],
  ["{area} (house call)", PRICES.Cyberjaya, "Cyberjaya"],
  ["{area} (house call)", PRICES.Bangi, "Bangi"],
];
const EXTRAS = [
  ["Late night (after 12 am)", "+RM5"],
  ["Last minute / urgent", "+RM10"],
];
const NOTES = [
  "Price includes full equipment",
  "Neat and professional service",
  "Book early to secure a slot",
  "Prices may vary for some locations",
];

const amount = (price: string) => Number(price.replace(/\D/g, ""));
const HOUSE_CALLS = [PRICES.Putrajaya, PRICES.Cyberjaya, PRICES.Bangi].sort(
  (a, b) => amount(a) - amount(b),
);

// Two-line glance shown before the customer picks a slot; the full list sits beside it.
export function PriceSummary({ lang, className = "" }: { lang: Lang; className?: string }) {
  const t = (text: string) => translate(lang, text);
  return (
    <dl className={`ticket grid gap-2 text-sm ${className}`}>
      <div className="flex justify-between gap-4">
        <dt>{t("At the shop")}</dt>
        <dd className="font-semibold tabular-nums">
          {PRICES.base} / {PRICES.adult}
        </dd>
      </div>
      <div className="flex justify-between gap-4 border-t border-dashed border-line pt-2">
        <dt>{t("House call")}</dt>
        <dd className="font-semibold tabular-nums">
          {HOUSE_CALLS[0]}–{HOUSE_CALLS.at(-1)}
        </dd>
      </div>
    </dl>
  );
}

export function PriceList({ lang }: { lang: Lang }) {
  const t = (text: string, vars?: Record<string, string>) => translate(lang, text, vars);
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
        <dl className="divide-y divide-dashed divide-line">
          {ROWS.map(([label, price, area]) => (
            <div key={area ?? label} className="flex justify-between py-3 text-sm">
              <dt>{t(label, area ? { area } : undefined)}</dt>
              <dd className="font-semibold tabular-nums">{price}</dd>
            </div>
          ))}
        </dl>
        <div>
          <h3 className="text-sm font-semibold">{t("Extra charges")}</h3>
          <dl className="mt-1 divide-y divide-dashed divide-line">
            {EXTRAS.map(([label, price]) => (
              <div key={label} className="flex justify-between py-3 text-sm">
                <dt>{t(label)}</dt>
                <dd className="font-semibold tabular-nums">{price}</dd>
              </div>
            ))}
          </dl>
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
