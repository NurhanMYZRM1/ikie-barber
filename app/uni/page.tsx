import { GraduationCap } from "lucide-react";
import { getBusy, getCatalog, getPublicShop } from "@/lib/data";
import { CustomerTimetable } from "@/components/customer-timetable";
import { LiveRefresh } from "@/components/live-refresh";
import { PublicFooter, PublicHeader } from "@/components/public-frame";
import { getLang } from "@/lib/lang";
import { translate } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const [lang, { shop }] = await Promise.all([getLang(), getPublicShop()]);
  return { title: `${shop.name} — ${translate(lang, "For uni students")}` };
}
// Uni visits: one page, so the owner can share its link with students.
export default async function UniPage() {
  const [{ shop, hours, preview }, catalog, busy] = await Promise.all([
    getPublicShop(),
    getCatalog(),
    getBusy(),
  ]);
  const lang = await getLang();
  const t = (text: string) => translate(lang, text);
  return (
    // Bottom padding clears the phone-only booking bar.
    <div className="pb-24 sm:pb-0">
      <LiveRefresh timezone={shop.timezone} />
      <PublicHeader shop={shop} lang={lang} preview={preview} />
      <main id="main" className="mx-auto max-w-3xl px-5 sm:px-8">
        <section className="border-b border-line pb-8 pt-6">
          <h1 className="flex items-center gap-3 font-display text-[2.5rem] font-semibold uppercase leading-none tracking-wide sm:text-5xl">
            <GraduationCap size={40} aria-hidden="true" className="shrink-0" />
            {t("For uni students")}
          </h1>
        </section>
        <CustomerTimetable
          shop={shop}
          hours={hours}
          busy={busy}
          catalog={catalog}
          initial={new Date().toISOString()}
          uni
        />
        <PublicFooter shop={shop} />
      </main>
    </div>
  );
}
