// Load the current business day and aggregate history only after verifying the owner.
import { getOwnerShop, getDayEntries, getDailyTotals, getUpcomingBookings } from "@/lib/data";
import { getShopToday } from "@/lib/time";
import { EarningsHome } from "@/components/earnings-home";
import { LiveRefresh } from "@/components/live-refresh";
import { BookingsList } from "@/components/bookings-list";

export default async function AdminPage() {
  const { shop, hours } = await getOwnerShop();
  const now = new Date();
  const [entries, days, bookings] = await Promise.all([
    getDayEntries(getShopToday(shop.timezone, now)),
    getDailyTotals(),
    getUpcomingBookings(),
  ]);
  return (
    <>
      <LiveRefresh timezone={shop.timezone} />
      <EarningsHome
        shop={shop}
        hours={hours}
        entries={entries}
        days={days}
        initial={now.toISOString()}
        upcoming={
          <BookingsList
            bookings={bookings}
            timezone={shop.timezone}
            currency={shop.currency}
            moreHref="/admin/bookings"
          />
        }
      />
    </>
  );
}
