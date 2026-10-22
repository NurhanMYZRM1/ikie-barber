"use client";
import { newId } from "@/lib/id";
import { useEffect, useRef, useState, useTransition } from "react";
import { X, Trash2 } from "lucide-react";
import { saveEarning, deleteEarning } from "@/app/admin/earnings-actions";
import type { Earning, ActionResult } from "@/lib/types";
import { Feedback, FieldError } from "./feedback";
import { useT } from "./lang";

// Native <dialog> gives us focus trapping, Escape, and focus restoration for free.
// CSS turns the same dialog into a thumb-reachable bottom sheet on phones.
export function EarningSheet({
  entry,
  currency,
  onClose,
}: {
  entry: Earning | null;
  currency: string;
  onClose: () => void;
}) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const [id] = useState(() => entry?.id || newId());
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    dialog.current?.showModal();
    amountInput.current?.focus();
  }, []);
  function run(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      try {
        const next = await action();
        setResult(next);
        if (next.ok) onClose();
      } catch {
        setResult({ ok: false, message: "Couldn’t save. Check your connection and try again." });
      }
    });
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="earning-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onClose={onClose}
      className="overflow-y-auto pb-[max(24px,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
      <div className="mb-6 flex items-center justify-between">
        <h2 id="earning-title" className="text-xl font-semibold">
          {entry ? t("Edit entry") : t("Add earnings")}
        </h2>
        <button
          type="button"
          className="btn px-3"
          aria-label={t("Close earnings form")}
          disabled={pending}
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          run(() =>
            saveEarning(
              {
                id,
                amount: String(data.get("amount") || "").trim(),
                note: data.get("note") || "",
                payment_method: data.get("payment_method") || "",
              },
              Boolean(entry),
            ),
          );
        }}
      >
        <label>
          {t("Amount ({currency})", { currency: currency === "MYR" ? "RM" : currency })}
          <input
            ref={amountInput}
            autoFocus
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            required
            placeholder="0.00"
            defaultValue={entry ? Number(entry.amount).toFixed(2) : ""}
            className="py-4 text-3xl font-semibold"
            aria-invalid={Boolean(result?.fields?.amount)}
            aria-describedby="amount-error"
          />
          <FieldError id="amount-error" message={result?.fields?.amount} />
        </label>
        <label>
          {t("Note")} <span className="font-normal text-muted">{t("(optional)")}</span>
          <input
            name="note"
            maxLength={200}
            placeholder={t("Haircut + beard")}
            defaultValue={entry?.note || ""}
          />
          <FieldError message={result?.fields?.note} />
        </label>
        <label>
          {t("Payment method")} <span className="font-normal text-muted">{t("(optional)")}</span>
          <select name="payment_method" defaultValue={entry?.payment_method || ""}>
            <option value="">{t("Not specified")}</option>
            {["Cash", "QR", "Card"].map((method) => (
              <option key={method} value={method}>
                {t(method)}
              </option>
            ))}
          </select>
        </label>
        <Feedback result={result} />
        <button disabled={pending} className="btn-primary w-full">
          {pending ? t("Saving…") : t("Save entry")}
        </button>
      </form>
      {entry && (
        <button
          disabled={pending}
          className="btn mt-3 w-full text-red-700 dark:text-red-300"
          onClick={() => {
            if (window.confirm(t("Delete this earnings entry? This cannot be undone.")))
              run(() => deleteEarning(entry.id));
          }}
        >
          <Trash2 size={16} />
          {t("Delete entry")}
        </button>
      )}
    </dialog>
  );
}
