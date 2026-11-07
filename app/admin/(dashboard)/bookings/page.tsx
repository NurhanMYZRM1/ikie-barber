// Every customer booking: upcoming ones can be cancelled, past ones stay as a record.
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getBookings, getOwnerShop } from "@/lib/data";
import { BookingsList } from "@/components/bookings-list";
import { LiveRefresh } from "@/components/live-refresh";
import { getT } from "@/lib/lang";

export default async function BookingsPage() {
  const [{ shop }, { upcoming, past }, t] = await Promise.all([
    getOwnerShop(),
    getBookings(),
    getT(),
  ]);
  return (
    <div className="max-w-3xl space-y-8">
      <LiveRefresh timezone={shop.timezone} />
      <header>
        <h1 className="page-title">{t("Bookings")}</h1>
        <p className="mt-3 text-sm text-muted">
          {t("Every customer booking. Cancel an upcoming one to free its slot.")}
        </p>
      </header>
      {/* Phones have no tab for visits; they are managed from here. */}
      <Link href="/admin/visits" className="card flex min-h-14 items-center gap-3 px-4 text-sm">
        <span className="flex-1 font-semibold">{t("Uni visits")}</span>
        <span className="text-muted">{t("Plan and pause campus days")}</span>
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
      <BookingsList bookings={upcoming} timezone={shop.timezone} currency={shop.currency} />
      <BookingsList
        bookings={past}
        timezone={shop.timezone}
        currency={shop.currency}
        title="Past bookings"
        empty="No past bookings yet."
        cancellable={false}
      />
      {past.length === 200 && (
        <p className="text-xs text-muted">{t("Showing the latest 200 past bookings.")}</p>
      )}
    </div>
  );
}
