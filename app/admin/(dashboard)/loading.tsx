// The protected shell stays visible while each dashboard list is loading.
import { getT } from "@/lib/lang";

export default async function LoadingDashboard() {
  const t = await getT();
  return (
    <div role="status" aria-busy="true" className="space-y-5">
      <p className="text-sm text-muted">{t("Loading your workspace…")}</p>
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-32 animate-pulse rounded-lg bg-ink/5" />
        ))}
      </div>
      <div className="h-52 animate-pulse rounded-lg bg-ink/5" />
    </div>
  );
}
