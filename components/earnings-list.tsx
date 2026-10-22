"use client";
// Each entry is one large touch target; editing reuses the same accessible earnings sheet.
import { useState } from "react";
import { Banknote, CreditCard, QrCode, Pencil } from "lucide-react";
import type { Earning } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { shopClock } from "@/lib/time";
import { EarningSheet } from "./earning-sheet";
import { useT } from "./lang";

export function EarningsList({
  entries,
  currency,
  timezone,
  empty = "No earnings logged today. Tap + to add one.",
}: {
  entries: Earning[];
  currency: string;
  timezone: string;
  empty?: string;
}) {
  const t = useT();
  const [editing, setEditing] = useState<Earning | null>(null);
  if (!entries.length) return <p className="card px-4 py-3 text-sm text-muted">{t(empty)}</p>;
  return (
    <>
      <ul className="card divide-y divide-line">
        {entries.map((entry) => {
          const Icon =
            entry.payment_method === "QR"
              ? QrCode
              : entry.payment_method === "Card"
                ? CreditCard
                : Banknote;
          return (
            <li key={entry.id}>
              <button
                className="flex min-h-20 w-full items-center gap-3 p-4 text-left hover:bg-ink/5 sm:p-5"
                onClick={() => setEditing(entry)}
                aria-label={t("Edit {item}, {amount}", {
                  item: entry.note || t("earnings entry"),
                  amount: formatMoney(entry.amount, currency),
                })}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ink/5 text-muted">
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {entry.note || t("Earnings entry")}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {shopClock(entry.created_at, timezone)} ·{" "}
                    {t(entry.payment_method || "Not specified")}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatMoney(entry.amount, currency)}
                </span>
                <Pencil size={13} className="ml-1 shrink-0 text-muted" />
              </button>
            </li>
          );
        })}
      </ul>
      {editing && (
        <EarningSheet entry={editing} currency={currency} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
