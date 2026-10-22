"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUpRight, Check, CircleCheck, House, MapPin, MessageCircle } from "lucide-react";
import type { Hours, Shop } from "@/lib/types";
import { AREAS } from "@/lib/types";
import {
  calendarLabel,
  getPreferredTimes,
  getShopToday,
  isShopAvailable,
  shiftDay,
} from "@/lib/time";
import { bookSlot, type BookingResult } from "@/app/booking-actions";
import { FieldError } from "./feedback";
import { newId } from "@/lib/id";
import { directions } from "@/lib/directions";
import { useClock } from "./shop-status";
import { PRICES } from "./price-list";
import { useLang, useT } from "./lang";

type Area = (typeof AREAS)[number];
type Confirmed = {
  day: string;
  label: string;
  area: Area;
  name: string;
  address: string;
  result: BookingResult;
};
const FIELDS = ["name", "phone", "address"] as const;

// Booked slots come from the server and stay visible but crossed out. Always recompute
// against live hours: a stale selection must not remain actionable after the owner
// changes hours, starts away mode, the slot gets booked, or the time passes.
export function CustomerTimetable({
  shop,
  hours,
  booked,
  initial,
}: {
  shop: Shop;
  hours: Hours[];
  booked: string[];
  initial: string;
}) {
  const lang = useLang();
  const t = useT();
  const areaName = (value: Area) =>
    value === "Shop" ? t("at the shop") : t("{area} house call", { area: value });
  const areaLabel = (value: Area) =>
    value === "Shop"
      ? t("At the shop · {base} / {adult}", { base: PRICES.base, adult: PRICES.adult })
      : t("{area} house call · {price}", { area: value, price: PRICES[value] });
  const now = useClock(initial);
  const today = getShopToday(shop.timezone, now);
  const available = isShopAvailable(shop, now);
  const [chosenDay, setChosenDay] = useState(() => {
    const initialNow = new Date(initial);
    const first = getShopToday(shop.timezone, initialNow);
    return (
      Array.from({ length: 8 }, (_, offset) => shiftDay(first, offset)).find((day) =>
        getPreferredTimes(shop, hours, day, initialNow, booked).some((time) => !time.booked),
      ) || first
    );
  });
  const [chosenTime, setChosenTime] = useState<string | null>(null);
  // One id per chosen slot, reused on retry so a lost response can't double-book.
  const [bookingId, setBookingId] = useState("");
  // After a lost response the slot may show booked by our own save; keep the form so
  // the retry (same id) can confirm it.
  const [unsure, setUnsure] = useState(false);
  // Once shown, the details form stays mounted so a taken slot or a new day never
  // wipes what the customer already typed.
  const [started, setStarted] = useState(false);
  const [area, setArea] = useState<Area>("Shop");
  const [result, setResult] = useState<BookingResult | null>(null);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  const [pending, startTransition] = useTransition();
  const slotsRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLHeadingElement>(null);
  const bookedRef = useRef<HTMLHeadingElement>(null);
  const day = chosenDay < today ? today : chosenDay;
  const times = getPreferredTimes(shop, hours, day, now, booked);
  const chosen = times.find((time) => time.start === chosenTime);
  const selected = chosen && (!chosen.booked || unsure) ? chosen : undefined;
  const longDate = (value: string) => calendarLabel(value, "EEEE, d MMMM yyyy", lang);
  const shortDate = (value: string) => calendarLabel(value, "EEE, d MMM", lang);
  const week = Array.from({ length: 7 }, (_, offset) => {
    const value = shiftDay(today, offset);
    const free = getPreferredTimes(shop, hours, value, now, booked).filter((time) => !time.booked);
    return { value, free: free.length };
  });
  const message = confirmed
    ? t("Hi {shop}, I've booked {date} at {time} ({area}). Name: {name}.", {
        shop: shop.name,
        date: longDate(confirmed.day),
        time: confirmed.label,
        area: areaName(confirmed.area),
        name: confirmed.name,
      })
    : null;
  const whatsapp = shop.whatsapp_number
    ? `https://wa.me/${shop.whatsapp_number}${message ? `?text=${encodeURIComponent(message)}` : ""}`
    : null;
  const fieldError = (field: (typeof FIELDS)[number]) => result?.fields?.[field];
  const describe = (field: (typeof FIELDS)[number]) => ({
    id: `booking-${field}`,
    "aria-invalid": Boolean(fieldError(field)),
    "aria-describedby": fieldError(field) ? `booking-${field}-error` : undefined,
  });

  // Land keyboard and screen-reader users on the first field the server rejected,
  // and on the confirmation heading once the booking is saved.
  useEffect(() => {
    const first = FIELDS.find((field) => result?.fields?.[field]);
    if (first) document.getElementById(`booking-${first}`)?.focus();
  }, [result]);
  useEffect(() => {
    if (confirmed) bookedRef.current?.focus();
  }, [confirmed]);

  function choose(start: string, byPointer: boolean) {
    setChosenTime(start);
    setBookingId(newId());
    setUnsure(false);
    setResult(null);
    setStarted(true);
    // Pointer users see the details step slide into view; keyboard focus stays put.
    if (!byPointer) return;
    requestAnimationFrame(() => {
      const top = detailsRef.current?.getBoundingClientRect().top;
      if (top === undefined || top < window.innerHeight * 0.7) return;
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollBy({ top: top - window.innerHeight * 0.3, behavior: calm ? "auto" : "smooth" });
    });
  }
  function changeTime() {
    const button = slotsRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    (
      button ?? slotsRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")
    )?.focus();
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    // onSubmit, not a form action: React resets a form after an action, which would
    // wipe what the customer typed whenever the server asks them to fix a field.
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const input = {
      id: bookingId,
      slot_start: selected.start,
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      area,
      address: String(form.get("address") ?? ""),
      note: String(form.get("note") ?? ""),
    };
    startTransition(async () => {
      try {
        const response = await bookSlot(input);
        setResult(response);
        if (response.ok)
          setConfirmed({
            day,
            label: selected.label,
            area,
            name: input.name.trim(),
            address: input.address.trim(),
            result: response,
          });
      } catch {
        // Safe to tap again: the same id is sent, so a booking that did save is recognised.
        setUnsure(true);
        setResult({
          ok: false,
          message: "Couldn’t send your booking. Check your connection and tap Book again.",
        });
      }
    });
  }

  if (confirmed)
    return (
      <section className="py-8 sm:py-10" aria-labelledby="booked-title">
        <CircleCheck size={32} aria-hidden="true" className="text-accent" />
        <h2
          id="booked-title"
          ref={bookedRef}
          tabIndex={-1}
          className="section-title mt-3 focus-visible:outline-none"
        >
          {t("You’re booked")}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted text-pretty">
          {t("Your time is saved. To change or cancel it, message me on WhatsApp.")}
        </p>
        <dl className="ticket mt-6 grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("When")}</dt>
            <dd className="text-right font-semibold tabular-nums">
              {calendarLabel(confirmed.day, "EEE, d MMMM", lang)} ·{" "}
              <span className="whitespace-nowrap">{confirmed.label}</span>
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("Where")}</dt>
            <dd className="text-right font-semibold">{areaLabel(confirmed.area)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("Name")}</dt>
            <dd className="text-right font-semibold">{confirmed.name}</dd>
          </div>
        </dl>
        {confirmed.area === "Shop" ? (
          <div className="mt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <MapPin size={17} aria-hidden="true" /> {t("Where to find me")}
            </h3>
            <p className="mt-2 whitespace-pre-line text-sm text-muted">
              {confirmed.result.address || t("I’ll send you the location on WhatsApp.")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:flex">
              {directions(confirmed.result.address, confirmed.result.maps_url).map(
                ([app, href]) => (
                  <a
                    key={app}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                  >
                    {app} <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                ),
              )}
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <House size={17} aria-hidden="true" /> {t("I’ll come to you")}
            </h3>
            <p className="mt-2 whitespace-pre-line text-sm text-muted">{confirmed.address}</p>
          </div>
        )}
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-8 w-full sm:w-auto"
          >
            <MessageCircle size={18} aria-hidden="true" /> {t("Send on WhatsApp")}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        )}
      </section>
    );

  if (!available)
    return (
      <section className="py-8 sm:py-10" aria-labelledby="paused-title">
        <h2 id="paused-title" className="section-title">
          {t("Booking is paused")}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted text-pretty">
          {t(
            "I’m not taking bookings right now. Message me on WhatsApp and I’ll reply when I’m back.",
          )}
        </p>
        {whatsapp ? (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-primary mt-6">
            <MessageCircle size={18} aria-hidden="true" /> {t("WhatsApp me")}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        ) : (
          <p className="mt-6 text-sm text-muted">{t("Contact details coming soon")}</p>
        )}
      </section>
    );

  return (
    <>
      <section
        id="timetable"
        className="scroll-mt-6 py-8 sm:py-10"
        aria-labelledby="timetable-title"
      >
        <h2 id="timetable-title" className="section-title">
          {t("Choose your time")}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {t("30-minute slots. Crossed-out times are taken.")}
        </p>

        <h3 className="step-label mt-6">{t("1. Date and time")}</h3>
        <div
          role="group"
          aria-label={t("Next 7 days")}
          className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0"
        >
          {week.map(({ value, free }, index) => (
            <button
              key={value}
              type="button"
              disabled={!free}
              aria-pressed={value === day}
              onClick={() => {
                setChosenDay(value);
                setChosenTime(null);
              }}
              className={`relative flex min-h-14 min-w-14 shrink-0 flex-col items-center justify-center rounded-md border px-2 text-xs transition-colors disabled:border-dashed disabled:text-muted/60 ${value === day ? "border-accent bg-accent text-on-accent" : "border-line bg-surface hover:border-ink"}`}
            >
              <span>{index === 0 ? t("Today") : calendarLabel(value, "EEE", lang)}</span>
              <span className="text-base font-semibold tabular-nums">
                {calendarLabel(value, "d", lang)}
              </span>
              <span className="sr-only">
                {free ? t("{count} free", { count: free }) : t("Fully booked")}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
          <label htmlFor="visit-date" className="text-xs font-medium text-muted">
            {t("Visit date")}
            <input
              id="visit-date"
              type="date"
              min={today}
              max={shiftDay(today, 30)}
              value={day}
              className="mt-1 w-auto text-ink"
              onChange={(event) => {
                if (event.target.value) {
                  setChosenDay(event.target.value);
                  setChosenTime(null);
                }
              }}
            />
          </label>
          <p className="pb-3 text-sm font-semibold">{longDate(day)}</p>
        </div>
        {times.length ? (
          <div
            ref={slotsRef}
            role="group"
            aria-label={t("Available times")}
            className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4"
          >
            {times.map((time) =>
              time.booked ? (
                <button
                  key={time.start}
                  type="button"
                  disabled
                  aria-label={t("{time}, booked", { time: time.label })}
                  className="flex min-h-11 cursor-not-allowed items-center justify-center rounded-md border border-dashed border-line px-2 py-3 text-xs text-muted/60 line-through tabular-nums"
                >
                  {time.label}
                </button>
              ) : (
                <button
                  key={time.start}
                  type="button"
                  aria-pressed={selected?.start === time.start}
                  onClick={(event) => choose(time.start, event.detail > 0)}
                  className={`flex min-h-11 items-center justify-center gap-1 rounded-md border px-2 py-3 text-xs font-semibold tabular-nums transition-colors ${selected?.start === time.start ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-ink hover:border-ink"}`}
                >
                  {selected?.start === time.start && <Check size={14} aria-hidden="true" />}
                  {time.label}
                </button>
              ),
            )}
          </div>
        ) : (
          <p role="status" className="card mt-4 p-4 text-sm leading-6 text-muted">
            {t("No times to book on this date. Choose another day, or message me on WhatsApp.")}
          </p>
        )}
        <p className="mt-3 text-xs text-muted">
          {t("Times follow {timezone}.", { timezone: shop.timezone.replaceAll("_", " ") })}
        </p>
        <p role="status" className="sr-only">
          {selected
            ? t("Selected {date} at {time}. Your details are next.", {
                date: longDate(day),
                time: selected.label,
              })
            : ""}
        </p>
        {chosen?.booked && !unsure && (
          <p role="status" className="card mt-6 p-4 text-sm">
            {t("{time} was just booked by someone else. Choose another time.", {
              time: chosen.label,
            })}
          </p>
        )}

        {started && (
          <form id="booking-form" onSubmit={submit} className="mt-8 space-y-4">
            <h3 ref={detailsRef} className="step-label scroll-mt-6">
              {t("2. Your details")}
            </h3>
            <div className="ticket flex items-center justify-between gap-3">
              <p className="min-w-0 text-sm">
                <span className="block text-xs text-muted">{t("Your time")}</span>
                {selected ? (
                  <span className="font-semibold tabular-nums">
                    {calendarLabel(day, "EEE, d MMMM", lang)} ·{" "}
                    <span className="whitespace-nowrap">{selected.label}</span>
                  </span>
                ) : (
                  <span className="font-semibold">{t("Pick a time above to book.")}</span>
                )}
              </p>
              <button type="button" onClick={changeTime} className="btn shrink-0 px-3 text-sm">
                {t("Change")}
              </button>
            </div>
            <div>
              <label htmlFor="booking-name">{t("Your name")}</label>
              <input
                {...describe("name")}
                name="name"
                required
                maxLength={60}
                autoComplete="name"
                className="mt-2"
              />
              <FieldError id="booking-name-error" message={fieldError("name")} />
            </div>
            <div>
              <label htmlFor="booking-phone">{t("WhatsApp number")}</label>
              <input
                {...describe("phone")}
                name="phone"
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0123456789"
                className="mt-2"
              />
              <FieldError id="booking-phone-error" message={fieldError("phone")} />
            </div>
            <div>
              <label htmlFor="booking-area">{t("Where")}</label>
              <select
                id="booking-area"
                name="area"
                value={area}
                onChange={(event) => setArea(event.target.value as Area)}
                className="mt-2"
              >
                {AREAS.map((value) => (
                  <option key={value} value={value}>
                    {areaLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            {area !== "Shop" && (
              <div>
                <label htmlFor="booking-address">{t("Your address")}</label>
                <textarea
                  {...describe("address")}
                  name="address"
                  required
                  rows={2}
                  maxLength={300}
                  autoComplete="street-address"
                  className="mt-2"
                />
                <FieldError id="booking-address-error" message={fieldError("address")} />
              </div>
            )}
            <div>
              <label htmlFor="booking-note">{t("Note (optional)")}</label>
              <input
                id="booking-note"
                name="note"
                maxLength={200}
                placeholder={t("Kids cut, beard trim…")}
                className="mt-2"
              />
            </div>
            {result && !result.ok && (
              <p role="alert" className="field-error">
                {t(result.message)}
              </p>
            )}
            <button
              type="submit"
              disabled={pending || !selected}
              className="btn-primary w-full sm:w-auto"
            >
              {pending ? t("Booking…") : t("Book this time")}
            </button>
          </form>
        )}
      </section>

      {selected && (
        // Phones only: keeps the chosen time and the main action in reach while scrolling.
        // globals.css hides it while a field is focused so the keyboard never covers inputs.
        <div
          data-booking-bar
          className="booking-bar fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] sm:hidden"
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={changeTime}
              className="flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center text-left"
            >
              <span className="w-full truncate text-sm font-semibold tabular-nums">
                {shortDate(day)} · {selected.label}
              </span>
              <span className="text-xs text-muted underline underline-offset-2">
                {t("Change time")}
              </span>
            </button>
            <button
              type="submit"
              form="booking-form"
              disabled={pending}
              className="btn-primary shrink-0"
            >
              {pending ? t("Booking…") : t("Book this time")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
