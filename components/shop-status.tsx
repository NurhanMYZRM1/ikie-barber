"use client";
import { useEffect, useState } from "react";
import { getShopStatus } from "@/lib/time";
import type { Shop, Hours } from "@/lib/types";
import { useLang } from "./lang";

// The initial clock comes from SSR, so the first client render matches exactly.
export function useClock(initial: string) {
  const [now, setNow] = useState(() => new Date(initial));
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function ShopStatus({
  shop,
  hours,
  initial,
}: {
  shop: Shop;
  hours: Hours[];
  initial: string;
}) {
  const now = useClock(initial);
  const status = getShopStatus(shop, hours, now, useLang());
  return (
    <div
      aria-live="polite"
      className={status.kind === "away" ? "rounded-lg border border-line bg-ink/5 px-5 py-4" : ""}
    >
      <p
        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${status.kind === "open" ? "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300" : status.kind === "closed" ? "bg-red-500/10 text-red-800 dark:text-red-300" : "text-ink"}`}
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${status.kind === "open" ? "bg-emerald-600" : status.kind === "closed" ? "bg-red-500" : "bg-muted"}`}
        />
        {status.label}
      </p>
      {status.kind === "away" && status.note && (
        <p className="mt-2 px-3 text-sm text-muted">{status.note}</p>
      )}
    </div>
  );
}
