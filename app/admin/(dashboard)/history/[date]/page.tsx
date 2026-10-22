// Validate the URL date before looking up that day; edits preserve the original business date.
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { getOwnerShop, getDayEntries } from "@/lib/data";
import { calendarLabel } from "@/lib/time";
import { formatMoney, sumMoney } from "@/lib/money";
import { EarningsList } from "@/components/earnings-list";
import { getLang } from "@/lib/lang";
import { translate } from "@/lib/i18n";

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!z.iso.date().safeParse(date).success) notFound();
  const { shop } = await getOwnerShop();
  const entries = await getDayEntries(date);
  const lang = await getLang();
  const t = (text: string, vars?: Record<string, number>) => translate(lang, text, vars);
  return (
    <div className="max-w-3xl">
      <Link href="/admin/history" className="btn mb-6 pl-0 text-muted">
        <ArrowLeft size={16} />
        {t("History")}
      </Link>
      <p className="eyebrow">{calendarLabel(date, "EEEE, d MMMM yyyy", lang)}</p>
      <h1 className="my-4 text-4xl font-semibold">
        {formatMoney(sumMoney(entries.map((entry) => entry.amount)), shop.currency)}
      </h1>
      <p className="mb-6 text-sm text-muted">
        {t("{count} entries · Tap to edit. Changes stay on this date.", {
          count: entries.length,
        })}
      </p>
      <EarningsList
        entries={entries}
        currency={shop.currency}
        timezone={shop.timezone}
        empty="No entries for this day."
      />
    </div>
  );
}
