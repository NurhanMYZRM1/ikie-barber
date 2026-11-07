// Everything customers can book and what it costs; the public page reads the same rows.
import { getOwnerCatalog, getOwnerShop } from "@/lib/data";
import { CatalogEditor } from "@/components/services-editor";
import { LiveRefresh } from "@/components/live-refresh";
import { getT } from "@/lib/lang";

export default async function ServicesPage() {
  const [{ shop }, catalog, t] = await Promise.all([getOwnerShop(), getOwnerCatalog(), getT()]);
  return (
    <div className="max-w-2xl space-y-8">
      <LiveRefresh timezone={shop.timezone} />
      <header>
        <h1 className="page-title">{t("Services & prices")}</h1>
        <p className="mt-3 text-sm text-muted">
          {t(
            "What customers can book, how long it takes and what it costs. Changes apply to new bookings; existing bookings keep the price agreed.",
          )}
        </p>
      </header>
      <CatalogEditor catalog={catalog} currency={shop.currency} />
    </div>
  );
}
