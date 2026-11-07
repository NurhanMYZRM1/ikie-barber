import Link from "next/link";
import { ArrowDown, ArrowRight, GraduationCap } from "lucide-react";
import { getBusy, getCatalog, getPublicShop } from "@/lib/data";
import { CustomerTimetable } from "@/components/customer-timetable";
import { ShopStatus } from "@/components/shop-status";
import { LiveRefresh } from "@/components/live-refresh";
import { PriceList, PriceSummary } from "@/components/price-list";
import { calendarLabel, isShopAvailable, shopClock } from "@/lib/time";
import { formatInTimeZone } from "date-fns-tz";
import { getLang } from "@/lib/lang";
import { translate } from "@/lib/i18n";
import { PublicFooter, PublicHeader } from "@/components/public-frame";
import { houseCallAreaNames } from "@/lib/pricing";

export const dynamic = "force-dynamic";
// Public page fetches the public profile, hours, prices and booked times (never who
// booked). The address is only revealed on the confirmation screen after booking.
export default async function VisitorPage() {
  const [{ shop, hours, preview }, catalog, busy] = await Promise.all([
    getPublicShop(),
    getCatalog(),
    getBusy(),
  ]);
  const lang = await getLang();
  const t = (text: string, vars?: Record<string, string>) => translate(lang, text, vars);
  const initial = new Date().toISOString();
  const acceptingRequests = isShopAvailable(shop, new Date(initial));
  const nextVisit = catalog.visits.find(
    (visit) => visit.is_open && new Date(visit.ends_at) > new Date(initial),
  );
  const areas = houseCallAreaNames(catalog, lang);
  return (
    // Bottom padding clears the phone-only booking bar.
    <div className="pb-24 sm:pb-0">
      <LiveRefresh timezone={shop.timezone} />
      <PublicHeader shop={shop} lang={lang} preview={preview} />
      <main id="main" className="mx-auto max-w-5xl px-5 sm:px-8">
        <section className="border-b border-line pb-8 pt-6 sm:pb-12 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end lg:gap-12">
          <div>
            <ShopStatus shop={shop} hours={hours} initial={initial} />
            <h1 className="mt-6 font-display text-[2.75rem] font-semibold uppercase leading-[0.92] tracking-wide sm:text-6xl lg:text-7xl">
              {t("Good hair.")}
              <br />
              {t("Good mood.")}
              <br />
              {t("Anywhere.")}
            </h1>
          </div>
          <div className="mt-5 lg:mt-0">
            {/* Always explain the service; the owner's description is optional. */}
            <p className="max-w-md text-base leading-7 text-pretty">
              {areas
                ? t("Haircuts at the shop, or I come to you in {areas}.", { areas })
                : t("Book your haircut at the shop.")}
            </p>
            {shop.description && (
              <p className="mt-2 max-w-md text-sm leading-6 text-muted">{shop.description}</p>
            )}
            <PriceSummary
              lang={lang}
              catalog={catalog}
              currency={shop.currency}
              className="mt-5 lg:hidden"
            />
            <div className="mt-6 flex flex-wrap gap-3">
              {acceptingRequests && (
                <a href="#visit" className="btn-primary">
                  {t("Book a time")}
                  <ArrowDown size={16} aria-hidden="true" />
                </a>
              )}
              <a href="#prices" className="btn-secondary lg:hidden">
                {t("Full price list")}
              </a>
            </div>
          </div>
        </section>
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
          <div id="visit" className="min-w-0 scroll-mt-6">
            <CustomerTimetable
              shop={shop}
              hours={hours}
              busy={busy}
              catalog={catalog}
              initial={initial}
            />
          </div>
          <aside className="lg:sticky lg:top-0 lg:self-start" aria-label={t("Prices")}>
            <PriceList lang={lang} catalog={catalog} currency={shop.currency} />
          </aside>
        </div>
        <section aria-labelledby="uni-title" className="border-t border-line py-8 sm:py-10">
          <h2 id="uni-title" className="section-title flex items-center gap-3">
            <GraduationCap size={26} aria-hidden="true" /> {t("For uni students")}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted text-pretty">
            {nextVisit
              ? t("Next visit: {date}, {time}.", {
                  date: calendarLabel(
                    formatInTimeZone(new Date(nextVisit.starts_at), shop.timezone, "yyyy-MM-dd"),
                    "EEE, d MMM",
                    lang,
                  ),
                  time: `${shopClock(nextVisit.starts_at, shop.timezone)}–${shopClock(nextVisit.ends_at, shop.timezone)}`,
                })
              : t("See upcoming uni visits and confirm the location with the owner on WhatsApp.")}
          </p>
          <Link href="/uni" className="btn-secondary mt-5">
            {t("See uni visits")} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
        <PublicFooter shop={shop} />
      </main>
    </div>
  );
}
