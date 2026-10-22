// Combine away mode and the weekly schedule, with the timezone visible beside the editor.
import Link from "next/link";
import { Globe2 } from "lucide-react";
import { getOwnerShop } from "@/lib/data";
import { HoursEditor } from "@/components/hours-editor";
import { LiveRefresh } from "@/components/live-refresh";
import { Availability } from "@/components/availability";
import { getT } from "@/lib/lang";

export default async function HoursPage() {
  const { shop, hours } = await getOwnerShop();
  const t = await getT();
  return (
    <div className="max-w-2xl space-y-6">
      <LiveRefresh timezone={shop.timezone} />
      <header>
        <h1 className="page-title">{t("Opening hours")}</h1>
        <p className="mt-3 text-sm text-muted">
          {t(
            "Customers can book 30-minute slots inside these hours. A closing time of 12:00 AM means midnight.",
          )}
        </p>
      </header>
      <Availability shop={shop} />
      <Link href="/admin/settings" className="flex min-h-11 items-center gap-2 text-sm text-muted">
        <Globe2 size={17} />
        {shop.timezone}
        <span className="ml-auto text-accent">{t("Change")}</span>
      </Link>
      <HoursEditor hours={hours} />
      <p className="text-xs leading-5 text-muted">
        {t(
          "Tap a day to edit. Changes appear on your shop page as soon as you save. Overnight hours aren’t supported.",
        )}
      </p>
    </div>
  );
}
