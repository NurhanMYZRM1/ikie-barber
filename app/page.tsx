import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { getBookedSlots, getPublicShop } from "@/lib/data";
import { CustomerTimetable } from "@/components/customer-timetable";
import { Brand } from "@/components/brand";
import { ShopStatus } from "@/components/shop-status";
import { LiveRefresh } from "@/components/live-refresh";
import { PriceList, PriceSummary } from "@/components/price-list";
import { isShopAvailable } from "@/lib/time";
import { getLang } from "@/lib/lang";
import { translate } from "@/lib/i18n";
import { LanguageSwitch } from "@/components/lang";

export const dynamic = "force-dynamic";
// Public page fetches the public profile, hours and booked times (never who booked).
// The address is only revealed on the confirmation screen after booking.
export default async function VisitorPage() {
  const [{ shop, hours, preview }, booked] = await Promise.all([getPublicShop(), getBookedSlots()]);
  const lang = await getLang();
  const t = (text: string, vars?: Record<string, string>) => translate(lang, text, vars);
  const initial = new Date().toISOString();
  const acceptingRequests = isShopAvailable(shop, new Date(initial));
  return (
    // Bottom padding clears the phone-only booking bar.
    <div className="pb-24 sm:pb-0">
      <LiveRefresh timezone={shop.timezone} />
      {preview && (
        <div className="bg-accent px-5 py-2.5 text-center text-xs text-on-accent">
          {t("Sample shop preview · Connect Supabase to make it yours.")}
        </div>
      )}
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 border-b border-line px-5 py-5 sm:px-8">
        <Link
          className="min-w-0 flex-1"
          href="/"
          aria-label={t("{name} home", { name: shop.name })}
        >
          <Brand name={shop.name} src={shop.logo_url} />
        </Link>
        <LanguageSwitch />
      </header>
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
              {t("Haircuts at the shop, or I come to you in Putrajaya, Cyberjaya and Bangi.")}
            </p>
            {shop.description && (
              <p className="mt-2 max-w-md text-sm leading-6 text-muted">{shop.description}</p>
            )}
            <PriceSummary lang={lang} className="mt-5 lg:hidden" />
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
            <CustomerTimetable shop={shop} hours={hours} booked={booked} initial={initial} />
          </div>
          <aside className="lg:sticky lg:top-0 lg:self-start" aria-label={t("Prices")}>
            <PriceList lang={lang} />
          </aside>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line py-6 text-xs text-muted">
          <span>{shop.name}</span>
          <span className="flex flex-wrap gap-x-4">
            {shop.whatsapp_number && (
              <a
                href={`https://wa.me/${shop.whatsapp_number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 underline-offset-2 hover:underline"
              >
                WhatsApp <ArrowUpRight size={12} aria-hidden="true" />
              </a>
            )}
            <a
              href="https://www.instagram.com/ikiekentang_/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center underline-offset-2 hover:underline"
            >
              Instagram @ikiekentang_
            </a>
          </span>
        </footer>
      </main>
    </div>
  );
}
