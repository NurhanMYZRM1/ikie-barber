"use client";
// Availability is saved separately from hours so an away message can override the whole week.
import { useState, useTransition } from "react";
import { Power, CalendarDays } from "lucide-react";
import { saveAvailability } from "@/app/admin/actions";
import { isShopAvailable, getShopToday, shiftDay, calendarLabel } from "@/lib/time";
import type { Shop, ActionResult } from "@/lib/types";
import { Feedback } from "./feedback";
import { useLang, useT } from "./lang";

export function Availability({ shop }: { shop: Shop }) {
  const lang = useLang();
  const t = useT();
  const available = isShopAvailable(shop);
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  function save(input: unknown) {
    startTransition(async () => {
      try {
        const response = await saveAvailability(input);
        setResult(response);
        if (response.ok) setEditing(false);
      } catch {
        setResult({ ok: false, message: "Couldn’t save. Check your connection and try again." });
      }
    });
  }
  return (
    <section className="card p-5" aria-labelledby="availability-title">
      <div className="flex items-center gap-3">
        <span className="rounded-md bg-accent/10 p-3 text-accent">
          <Power size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="availability-title" className="font-semibold">
            {available ? t("Shop is available") : t("Shop is unavailable")}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {available
              ? t("Following your weekly opening hours")
              : t("Away mode overrides opening hours")}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={available}
          aria-label={t("Shop is available")}
          disabled={pending}
          onClick={() =>
            available
              ? setEditing(!editing)
              : save({ is_available: true, unavailable_until: null, unavailable_note: null })
          }
          className="flex h-12 w-14 shrink-0 items-center justify-center"
        >
          <span
            className={`flex h-7 w-12 items-center rounded-full px-1 ${available ? "bg-accent justify-end" : "bg-muted/40 justify-start"}`}
          >
            <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
          </span>
        </button>
      </div>
      {!available && (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
          <p className="text-muted">
            {shop.unavailable_until
              ? t("Back on {date}", {
                  date: calendarLabel(shop.unavailable_until, "EEE, d MMM", lang),
                })
              : t("Until further notice")}
          </p>
          <button onClick={() => setEditing(!editing)} className="btn text-accent">
            {t("Edit away details")}
          </button>
        </div>
      )}
      {editing && (
        <form
          className="mt-5 space-y-4 border-t border-line pt-5"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            save({
              is_available: false,
              unavailable_until: data.get("back") || null,
              unavailable_note: data.get("note") || null,
            });
          }}
        >
          <p className="text-sm text-muted">
            {t("Let customers know you’re taking some time away.")}
          </p>
          <label>
            <span className="flex items-center gap-2">
              <CalendarDays size={16} />
              {t("Back on")} <span className="font-normal text-muted">{t("(optional)")}</span>
            </span>
            <input
              name="back"
              type="date"
              min={shiftDay(getShopToday(shop.timezone), 1)}
              defaultValue={available ? "" : shop.unavailable_until || ""}
            />
          </label>
          <label>
            {t("Note")} <span className="font-normal text-muted">{t("(optional)")}</span>
            <textarea
              name="note"
              maxLength={140}
              rows={2}
              defaultValue={available ? "" : shop.unavailable_note || ""}
              placeholder={t("Taking a short break. See you soon!")}
            />
          </label>
          <p className="text-xs text-muted">
            {t("Automatically available from midnight on your return date.")}
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
              {t("Cancel")}
            </button>
            <button disabled={pending} className="btn-primary flex-1">
              {pending ? t("Saving…") : t("Set as unavailable")}
            </button>
          </div>
        </form>
      )}
      {result && (
        <div className="mt-4">
          <Feedback result={result} />
        </div>
      )}
    </section>
  );
}
