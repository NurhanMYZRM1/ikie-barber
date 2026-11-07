"use client";
// Plan uni visits. Duplicating copies the services, prices and buffers onto a new
// date; pausing stops new bookings but keeps the ones already made.
import { useState, useTransition } from "react";
import { Copy, Pause, Play, Plus, X } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { deleteVisit, saveVisit, setVisitOpen, type VisitResult } from "@/app/admin/visits-actions";
import { validationFields, visitSchema } from "@/lib/validation";
import { calendarLabel, getShopToday, shiftDay, shopClock } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { newId } from "@/lib/id";
import type { ActionResult, Booking, Service, Shop, Visit } from "@/lib/types";
import { BookingsList } from "./bookings-list";
import { Feedback, FieldError } from "./feedback";
import { useLang, useT } from "./lang";

type Draft = {
  id: string;
  date: string;
  start: string;
  end: string;
  buffer_before: number;
  buffer_after: number;
  is_open: boolean;
  services: Record<string, string>;
};
const gap = (from: string, to: string) =>
  (new Date(to).getTime() - new Date(from).getTime()) / 60_000;

export function VisitsManager({
  visits,
  services,
  bookings,
  shop,
}: {
  visits: Visit[];
  services: Service[];
  bookings: Booking[];
  shop: Shop;
}) {
  const t = useT();
  const lang = useLang();
  const [form, setForm] = useState<{ draft: Draft; editing: boolean } | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const today = getShopToday(shop.timezone);
  const local = (instant: string, pattern: string) =>
    formatInTimeZone(new Date(instant), shop.timezone, pattern);
  const draftOf = (visit: Visit): Draft => ({
    id: visit.id,
    date: local(visit.starts_at, "yyyy-MM-dd"),
    start: local(visit.starts_at, "HH:mm"),
    end: local(visit.ends_at, "HH:mm"),
    buffer_before: gap(visit.reserved_from, visit.starts_at),
    buffer_after: gap(visit.ends_at, visit.reserved_until),
    is_open: visit.is_open,
    services: Object.fromEntries(
      Object.entries(visit.services).map(([id, price]) => [
        id,
        price === null ? "" : String(price),
      ]),
    ),
  });
  // Same weekday, the first one after today.
  function duplicate(visit: Visit) {
    const draft = draftOf(visit);
    let date = shiftDay(draft.date, 7);
    while (date <= today) date = shiftDay(date, 7);
    setForm({ draft: { ...draft, id: newId(), date, is_open: true }, editing: false });
  }
  function act(run: () => Promise<ActionResult>) {
    startTransition(async () => {
      try {
        setResult(await run());
      } catch {
        setResult({ ok: false, message: "Couldn’t save. Check your connection and try again." });
      }
    });
  }
  const upcoming = visits.filter((visit) => new Date(visit.ends_at) > new Date()).reverse();
  const past = visits.filter((visit) => new Date(visit.ends_at) <= new Date());
  const when = (visit: Visit) =>
    `${calendarLabel(local(visit.starts_at, "yyyy-MM-dd"), "EEE, d MMM", lang)} · ${shopClock(visit.starts_at, shop.timezone)}–${shopClock(visit.ends_at, shop.timezone)}`;

  return (
    <div className="space-y-8">
      {form ? (
        <VisitForm
          key={form.draft.id}
          draft={form.draft}
          editing={form.editing}
          services={services}
          shop={shop}
          today={today}
          onDone={() => setForm(null)}
        />
      ) : (
        <button
          type="button"
          className="btn-primary w-full sm:w-auto"
          onClick={() =>
            setForm({
              editing: false,
              draft: {
                id: newId(),
                date: shiftDay(today, 1),
                start: "10:00",
                end: "13:00",
                buffer_before: 30,
                buffer_after: 30,
                is_open: true,
                services: {},
              },
            })
          }
        >
          <Plus size={18} aria-hidden="true" /> {t("New visit")}
        </button>
      )}
      <Feedback result={result} />

      <section aria-labelledby="upcoming-visits" className="space-y-3">
        <h2 id="upcoming-visits" className="text-lg font-semibold">
          {t("Upcoming visits")}
        </h2>
        {upcoming.length ? (
          upcoming.map((visit) => {
            const own = bookings.filter((booking) => booking.visit_id === visit.id);
            return (
              <article key={visit.id} className="card space-y-4 p-5" aria-label={when(visit)}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold tabular-nums">{when(visit)}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${visit.is_open ? "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300" : "bg-ink/10"}`}
                  >
                    {visit.is_open ? t("Open for bookings") : t("Paused")}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  {t(
                    "Travel and setup: {before} min before, {after} min after. Shop and house-call times are closed from {from} to {until}.",
                    {
                      before: gap(visit.reserved_from, visit.starts_at),
                      after: gap(visit.ends_at, visit.reserved_until),
                      from: shopClock(visit.reserved_from, shop.timezone),
                      until: shopClock(visit.reserved_until, shop.timezone),
                    },
                  )}
                </p>
                <p className="text-sm">
                  {services
                    .filter((service) => service.id in visit.services)
                    .map((service) => {
                      const price = visit.services[service.id] ?? service.university_price;
                      return `${service.name} ${price === null ? "–" : formatMoney(price, shop.currency)}`;
                    })
                    .join(" · ")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setForm({ draft: draftOf(visit), editing: true })}
                  >
                    {t("Edit")}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => duplicate(visit)}>
                    <Copy size={16} aria-hidden="true" /> {t("Duplicate")}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="btn-secondary"
                    onClick={() => act(() => setVisitOpen(visit.id, !visit.is_open))}
                  >
                    {visit.is_open ? (
                      <>
                        <Pause size={16} aria-hidden="true" /> {t("Pause bookings")}
                      </>
                    ) : (
                      <>
                        <Play size={16} aria-hidden="true" /> {t("Open for bookings")}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={pending || own.length > 0}
                    className="btn text-muted"
                    onClick={() => {
                      if (window.confirm(t("Cancel the visit on {date}?", { date: when(visit) })))
                        act(() => deleteVisit(visit.id));
                    }}
                  >
                    <X size={16} aria-hidden="true" /> {t("Cancel visit")}
                  </button>
                </div>
                {own.length > 0 && (
                  <p className="text-xs text-muted">
                    {t(
                      "To cancel this visit, message and cancel its bookings first. Pausing keeps them.",
                    )}
                  </p>
                )}
                <BookingsList
                  bookings={own}
                  timezone={shop.timezone}
                  currency={shop.currency}
                  title="Booked at this visit"
                  empty="No bookings yet."
                />
              </article>
            );
          })
        ) : (
          <p className="card px-4 py-3 text-sm text-muted">{t("No upcoming visits.")}</p>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past-visits" className="space-y-3">
          <h2 id="past-visits" className="text-lg font-semibold">
            {t("Past visits")}
          </h2>
          <ul className="card divide-y divide-line">
            {past.map((visit) => (
              <li key={visit.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold tabular-nums">{when(visit)}</span>
                </span>
                <button
                  type="button"
                  className="btn px-3 text-accent"
                  onClick={() => duplicate(visit)}
                >
                  <Copy size={16} aria-hidden="true" /> {t("Duplicate")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function VisitForm({
  draft,
  editing,
  services,
  shop,
  today,
  onDone,
}: {
  draft: Draft;
  editing: boolean;
  services: Service[];
  shop: Shop;
  today: string;
  onDone: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const [chosen, setChosen] = useState<Record<string, string>>(draft.services);
  const [result, setResult] = useState<VisitResult | null>(null);
  const [pending, startTransition] = useTransition();
  const field = (name: string) => ({
    name,
    "aria-invalid": Boolean(result?.fields?.[name]),
  });
  return (
    <form
      className="card space-y-5 p-5 sm:p-6"
      aria-labelledby="visit-form-title"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const input = {
          id: draft.id,
          date: form.get("date"),
          start: form.get("start"),
          end: form.get("end"),
          buffer_before: form.get("buffer_before"),
          buffer_after: form.get("buffer_after"),
          is_open: form.get("is_open") === "on",
          services: chosen,
        };
        const parsed = visitSchema.safeParse(input);
        if (!parsed.success) {
          setResult({
            ok: false,
            message: "Check the highlighted fields.",
            fields: validationFields(parsed.error),
          });
          return;
        }
        startTransition(async () => {
          try {
            const response = await saveVisit(input, editing);
            setResult(response);
            if (response.ok) onDone();
          } catch {
            setResult({
              ok: false,
              message: "Couldn’t save. Check your connection and try again.",
            });
          }
        });
      }}
    >
      <h2 id="visit-form-title" className="text-lg font-semibold">
        {editing ? t("Edit visit") : t("New visit")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <label>
          {t("Date")}
          <input {...field("date")} type="date" min={today} required defaultValue={draft.date} />
          <FieldError message={result?.fields?.date} />
        </label>
        <label>
          {t("Starts")}
          <input {...field("start")} type="time" step={1800} required defaultValue={draft.start} />
          <FieldError message={result?.fields?.start} />
        </label>
        <label>
          {t("Ends")}
          <input {...field("end")} type="time" step={1800} required defaultValue={draft.end} />
          <FieldError message={result?.fields?.end} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          {t("Travel and setup before (minutes)")}
          <input
            {...field("buffer_before")}
            type="number"
            min={0}
            max={240}
            step={15}
            required
            defaultValue={draft.buffer_before}
          />
          <FieldError message={result?.fields?.buffer_before} />
        </label>
        <label>
          {t("Travel and setup after (minutes)")}
          <input
            {...field("buffer_after")}
            type="number"
            min={0}
            max={240}
            step={15}
            required
            defaultValue={draft.buffer_after}
          />
          <FieldError message={result?.fields?.buffer_after} />
        </label>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">
          {t("Services and visit prices ({currency})", { currency: shop.currency })}
        </legend>
        <p className="text-xs text-muted">
          {t("Leave a price blank to use the service’s uni price.")}
        </p>
        {services
          .filter((service) => service.is_active || service.id in chosen)
          .map((service) => {
            const on = service.id in chosen;
            return (
              <div
                key={service.id}
                className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3"
              >
                <label className="flex min-h-11 items-center gap-3 font-normal">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(event) => {
                      const next = { ...chosen };
                      if (event.target.checked) next[service.id] = "";
                      else delete next[service.id];
                      setChosen(next);
                    }}
                  />
                  {service.name}
                </label>
                <input
                  aria-label={t("Visit price for {service}", { service: service.name })}
                  inputMode="decimal"
                  disabled={!on}
                  value={chosen[service.id] ?? ""}
                  placeholder={
                    service.university_price === null
                      ? t("Set a price")
                      : formatMoney(service.university_price, shop.currency)
                  }
                  onChange={(event) => setChosen({ ...chosen, [service.id]: event.target.value })}
                />
              </div>
            );
          })}
        <FieldError message={result?.fields?.services} />
      </fieldset>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" name="is_open" defaultChecked={draft.is_open} />
        {t("Accept bookings")}
      </label>
      <FieldError message={result?.fields?.is_open} />
      {result?.clashes?.length ? (
        <div
          role="alert"
          className="rounded-md bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
        >
          <p className="font-semibold">{t("This visit clashes with:")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {result.clashes.map((clash) => (
              <li key={`${clash.kind}-${clash.start}`}>
                {calendarLabel(
                  formatInTimeZone(new Date(clash.start), shop.timezone, "yyyy-MM-dd"),
                  "EEE, d MMM",
                  lang,
                )}{" "}
                {shopClock(clash.start, shop.timezone)}–{shopClock(clash.end, shop.timezone)} ·{" "}
                {clash.kind === "visit"
                  ? t("Uni visit · {area}", { area: clash.name })
                  : clash.name}
              </li>
            ))}
          </ul>
          <p className="mt-2">{t("Choose another time, or move or cancel those first.")}</p>
        </div>
      ) : (
        <Feedback result={result} />
      )}
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" onClick={onDone}>
          {t("Close")}
        </button>
        <button disabled={pending} className="btn-primary flex-1">
          {pending ? t("Saving…") : t("Save visit")}
        </button>
      </div>
    </form>
  );
}
