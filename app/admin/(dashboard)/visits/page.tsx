// Uni visits and the bookings made at each one.
import Link from "next/link";
import { getBookings, getOwnerCatalog, getOwnerShop } from "@/lib/data";
import { VisitsManager } from "@/components/visits-manager";
import { LiveRefresh } from "@/components/live-refresh";
import { isShopAvailable } from "@/lib/time";
import { getT } from "@/lib/lang";

export default async function VisitsPage() {
  const [{ shop }, { services, visits }, { upcoming, past }, t] = await Promise.all([
    getOwnerShop(),
    getOwnerCatalog(),
    getBookings(),
    getT(),
  ]);
  return (
    <div className="max-w-3xl space-y-6">
      <LiveRefresh timezone={shop.timezone} />
      <header>
        <h1 className="page-title">{t("Uni visits")}</h1>
        <p className="mt-3 text-sm text-muted">
          {t(
            "Plan campus days. Students book inside the visit’s hours, and the travel and setup time around it stays free of other bookings.",
          )}
        </p>
      </header>
      {/* Why visits may not be bookable right now, said plainly. */}
      {!shop.whatsapp_number && (
        <p className="card p-4 text-sm">
          {t("Add your WhatsApp number in Settings before opening a visit.")}{" "}
          <Link href="/admin/settings" className="font-semibold text-accent underline">
            {t("Settings")}
          </Link>
        </p>
      )}
      {!isShopAvailable(shop) && (
        <p className="card p-4 text-sm">
          {t("Away mode is on, so no visit takes bookings until you’re back.")}
        </p>
      )}
      <VisitsManager
        visits={visits}
        services={services}
        bookings={[...upcoming, ...past]}
        shop={shop}
      />
    </div>
  );
}
