"use client";
// Recompute visible totals from the shop clock so a page left open crosses midnight correctly.
import Link from "next/link";
import { useState } from "react";
import { Plus, ArrowUpRight, ArrowRight } from "lucide-react";
import type { Shop, Hours, Earning, DailyTotal } from "@/lib/types";
import { getShopToday, periodStarts, shopDateLabel } from "@/lib/time";
import { formatMoney, sumMoney } from "@/lib/money";
import { useClock, ShopStatus } from "./shop-status";
import { Availability } from "./availability";
import { EarningsList } from "./earnings-list";
import { EarningSheet } from "./earning-sheet";
import { useLang, useT } from "./lang";

export function EarningsHome({
  shop,
  hours,
  entries,
  days,
  initial,
  upcoming,
}: {
  shop: Shop;
  hours: Hours[];
  entries: Earning[];
  days: DailyTotal[];
  initial: string;
  upcoming?: React.ReactNode;
}) {
  const lang = useLang();
  const t = useT();
  const now = useClock(initial);
  const today = getShopToday(shop.timezone, now);
  const period = periodStarts(today);
  const [adding, setAdding] = useState(false);
  // At midnight this filter immediately empties while the server refresh is in flight.
  // Yesterday's entries remain in Postgres and are accessible through History.
  const todaysEntries = entries.filter((entry) => entry.business_date === today);
  const todaysTotal = days.find((day) => day.business_date === today);
  const week = sumMoney(
    days
      .filter((day) => day.business_date >= period.week && day.business_date <= today)
      .map((day) => day.total),
  );
  const month = sumMoney(
    days
      .filter((day) => day.business_date >= period.month && day.business_date <= today)
      .map((day) => day.total),
  );
  const count = Number(todaysTotal?.entry_count || 0);
  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{shopDateLabel(shop.timezone, now, lang)}</p>
          <h1 className="page-title mt-1">{t("Today")}</h1>
        </div>
        <Link href="/" target="_blank" className="btn-secondary hidden sm:flex">
          {t("View shop")}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </header>
      {upcoming}
      <section aria-labelledby="earnings-title">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 id="earnings-title" className="text-lg font-semibold">
            {t("Earnings")}
          </h2>
          <button onClick={() => setAdding(true)} className="btn-primary hidden lg:flex">
            <Plus size={18} aria-hidden="true" />
            {t("Add earnings")}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="col-span-2 rounded-lg bg-accent p-5 text-on-accent sm:col-span-1">
            <p className="text-sm text-on-accent/80">{t("Today’s earnings")}</p>
            <p className="mt-2 break-words text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
              {formatMoney(todaysTotal?.total || 0, shop.currency)}
            </p>
            <p className="mt-2 text-xs text-on-accent/70">
              {count === 1 ? t("1 entry") : t("{count} entries", { count })} ·{" "}
              {t("Resets at midnight. Past days stay in History.")}
            </p>
          </div>
          {[
            { title: "This week", amount: week },
            { title: "This month", amount: month },
          ].map(({ title, amount }) => (
            <div key={title} className="card flex flex-col justify-between p-4">
              <p className="text-xs text-muted">{t(title)}</p>
              <p className="mt-2 break-words text-lg font-semibold tabular-nums">
                {formatMoney(amount, shop.currency)}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section aria-labelledby="entries-title">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 id="entries-title" className="text-lg font-semibold">
            {t("Today’s entries")}
          </h2>
          <Link href="/admin/history" className="btn px-0 text-sm text-muted">
            {t("See earnings history")}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <EarningsList entries={todaysEntries} currency={shop.currency} timezone={shop.timezone} />
        {todaysEntries.length > 0 && (
          <p className="mt-2 text-xs text-muted">{t("Tap an entry to edit or delete it.")}</p>
        )}
      </section>
      <section className="space-y-3" aria-label={t("Shop status")}>
        <Availability shop={shop} />
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-xs text-muted">{t("What your customers see")}</p>
          <ShopStatus shop={shop} hours={hours} initial={initial} />
        </div>
      </section>
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 bg-canvas px-5 py-3 lg:hidden">
        <button onClick={() => setAdding(true)} className="btn-primary w-full">
          <Plus size={18} aria-hidden="true" />
          {t("Add earnings")}
        </button>
      </div>
      {adding && (
        <EarningSheet entry={null} currency={shop.currency} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}
