// Fetch historical totals on the server; the client handles the shop-local display clock.
import { getOwnerShop, getDailyTotals } from "@/lib/data";
import { History } from "@/components/history";
import { LiveRefresh } from "@/components/live-refresh";
export default async function HistoryPage() {
  const { shop } = await getOwnerShop();
  const days = await getDailyTotals();
  return (
    <>
      <LiveRefresh timezone={shop.timezone} />
      <History shop={shop} days={days} initial={new Date().toISOString()} />
    </>
  );
}
