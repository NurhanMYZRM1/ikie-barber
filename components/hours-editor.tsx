"use client";
// Edit one day at a time to keep the mobile form short and avoid overwriting other days.
import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { DAYS, timeLabel } from "@/lib/time";
import { saveHours } from "@/app/admin/actions";
import { hoursSchema, validationFields } from "@/lib/validation";
import type { Hours, ActionResult } from "@/lib/types";
import { Feedback, FieldError } from "./feedback";
import { useT } from "./lang";

function DayEditor({ day }: { day: Hours }) {
  const t = useT();
  const name = t(DAYS[day.day_of_week]);
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(day.is_open);
  const [hasBreak, setHasBreak] = useState(Boolean(day.break_start));
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="border-b border-line last:border-0">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-20 w-full items-center gap-3 px-5 text-left"
      >
        <span className={`h-2 w-2 rounded-full ${day.is_open ? "bg-accent" : "bg-muted/30"}`} />
        <span className="flex-1 font-medium">{name}</span>
        <span className="text-right text-sm text-muted">
          {day.is_open ? (
            <>
              {timeLabel(day.open_time)}
              <span className="mx-1">–</span>
              {timeLabel(day.close_time)}
            </>
          ) : (
            t("Closed all day")
          )}
        </span>
        <ChevronDown size={16} className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <form
          className="space-y-5 px-5 pb-6"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const input = {
              day_of_week: day.day_of_week,
              is_open: working,
              open_time: form.get("open_time"),
              close_time: form.get("close_time"),
              break_start: hasBreak ? form.get("break_start") : null,
              break_end: hasBreak ? form.get("break_end") : null,
            };
            const parsed = hoursSchema.safeParse(input);
            if (!parsed.success) {
              setResult({
                ok: false,
                message: "Check the highlighted times.",
                fields: validationFields(parsed.error),
              });
              return;
            }
            startTransition(async () => {
              try {
                const response = await saveHours(parsed.data);
                setResult(response);
                if (response.ok) setOpen(false);
              } catch {
                setResult({ ok: false, message: "Couldn’t save. Please try again." });
              }
            });
          }}
        >
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={working}
              onChange={(event) => setWorking(event.target.checked)}
            />
            {t("Open on {day}", { day: name })}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(["open_time", "close_time"] as const).map((key, i) => (
              <label key={key}>
                {t(i === 0 ? "From" : "To")}
                <input
                  aria-label={t(i === 0 ? "From" : "To")}
                  name={key}
                  type="time"
                  step="900"
                  required
                  defaultValue={day[key].slice(0, 5)}
                  aria-invalid={Boolean(result?.fields?.[key])}
                  aria-describedby={`${day.day_of_week}-${key}-error`}
                />
                <FieldError
                  id={`${day.day_of_week}-${key}-error`}
                  message={result?.fields?.[key]}
                />
              </label>
            ))}
          </div>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={hasBreak}
              onChange={(event) => setHasBreak(event.target.checked)}
            />
            {t("Include a break")}
          </label>
          {hasBreak && (
            <div className="grid grid-cols-2 gap-3">
              <label>
                {t("Break starts")}
                <input
                  name="break_start"
                  type="time"
                  step="900"
                  required
                  defaultValue={day.break_start?.slice(0, 5) || "13:00"}
                />
              </label>
              <label>
                {t("Break ends")}
                <input
                  name="break_end"
                  type="time"
                  step="900"
                  required
                  defaultValue={day.break_end?.slice(0, 5) || "14:00"}
                />
                <FieldError message={result?.fields?.break_end} />
              </label>
            </div>
          )}
          <Feedback result={result} />
          <button disabled={pending} className="btn-primary w-full">
            {pending ? t("Saving…") : t("Save {day}", { day: name })}
          </button>
        </form>
      )}
    </div>
  );
}
export function HoursEditor({ hours }: { hours: Hours[] }) {
  const t = useT();
  return (
    <section className="card overflow-hidden" aria-label={t("Weekly hours")}>
      {hours.map((day) => (
        <DayEditor key={`${day.day_of_week}-${JSON.stringify(day)}`} day={day} />
      ))}
    </section>
  );
}
