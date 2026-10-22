"use client";
// History groups preserved earnings by business date; the chart needs no extra library.
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import type { Shop, DailyTotal } from "@/lib/types";
import { getShopToday, periodStarts, calendarLabel, shiftDay } from "@/lib/time";
import { formatMoney, sumMoney } from "@/lib/money";
import { useClock } from "./shop-status";
import { useLang, useT } from "./lang";

export function History({
  shop,
  days,
  initial,
}: {
  shop: Shop;
  days: DailyTotal[];
  initial: string;
}) {
  const lang = useLang();
  const t = useT();
  const today = getShopToday(shop.timezone, useClock(initial));
  const starts = periodStarts(today);
  const recent = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDay(today, index - 6);
    return { date, total: Number(days.find((day) => day.business_date === date)?.total || 0) };
  });
  const max = Math.max(1, ...recent.map((day) => day.total));
  const quietWeek = recent.every((day) => day.total === 0);
  const past = days.filter((day) => day.business_date < today);
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="page-title">{t("Earnings history")}</h1>
        <p className="mt-3 text-sm text-muted">
          {t("Daily totals for every day you’ve recorded earnings.")}
        </p>
      </header>
      <section className="card p-5 sm:p-6">
        <div className="flex justify-between">
          <h2 className="font-semibold">{t("The last 7 days")}</h2>
          <span className="text-xs text-muted">
            {shop.currency === "MYR" ? "RM" : shop.currency}
          </span>
        </div>
        {quietWeek && (
          <p className="mt-2 text-sm text-muted">{t("No earnings recorded in the last 7 days.")}</p>
        )}
        <div className="mt-7 flex h-36 items-end gap-3 sm:gap-5">
          {recent.map((day) => (
            <div
              key={day.date}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
            >
              <div
                role="img"
                aria-label={`${calendarLabel(day.date, "EEE, d MMM", lang)}: ${formatMoney(day.total, shop.currency)}`}
                title={formatMoney(day.total, shop.currency)}
                style={{ height: `${Math.max(2, (day.total / max) * 100)}%` }}
                className={`w-full max-w-12 rounded-t-md ${day.date === today ? "bg-accent" : "bg-accent/25"}`}
              />
              <span className="text-[10px] text-muted">{calendarLabel(day.date, "EEE", lang)}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "This week", start: starts.week },
          { label: "This month", start: starts.month },
        ].map((period) => (
          <div key={period.label} className="card p-5">
            <p className="text-xs text-muted">{t(period.label)}</p>
            <p className="mt-3 break-words text-xl font-semibold">
              {formatMoney(
                sumMoney(
                  days
                    .filter(
                      (day) => day.business_date >= period.start && day.business_date <= today,
                    )
                    .map((day) => day.total),
                ),
                shop.currency,
              )}
            </p>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">{t("Past days")}</h2>
          <Link href="/admin" className="btn text-sm text-muted">
            {t("View today")}
            <ArrowRight size={15} />
          </Link>
        </div>
        {past.length ? (
          <ul className="card divide-y divide-line">
            {past.map((day) => (
              <li key={day.business_date}>
                <Link
                  href={`/admin/history/${day.business_date}`}
                  className="flex min-h-20 items-center gap-3 p-5 hover:bg-ink/5"
                >
                  <CalendarDays size={19} className="shrink-0 text-muted" />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">
                      {calendarLabel(day.business_date, "EEE, d MMM yyyy", lang)}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {Number(day.entry_count) === 1
                        ? t("1 entry")
                        : t("{count} entries", { count: day.entry_count })}
                    </span>
                  </span>
                  <span className="text-sm font-semibold">
                    {formatMoney(day.total, shop.currency)}
                  </span>
                  <ArrowRight size={15} className="shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="card p-8 text-center text-sm text-muted">
            {t("No past earnings yet. Today’s entries will appear here after midnight.")}
          </div>
        )}
      </div>
      <p className="text-xs leading-5 text-muted">
        {t(
          "Weeks start on Monday. Dates follow {timezone}. Entries are kept when a new day starts.",
          { timezone: shop.timezone },
        )}
      </p>
    </div>
  );
}
