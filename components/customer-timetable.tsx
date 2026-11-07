"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUpRight, Check, CircleCheck, House, MapPin, MessageCircle } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import type { Busy, Catalog, Hours, PublicShop, PublicVisit } from "@/lib/types";
import {
  calendarLabel,
  getPreferredTimes,
  getShopToday,
  getVisitTimes,
  isShopAvailable,
  shiftDay,
  shopClock,
} from "@/lib/time";
import { priceRange, quote, servicePrice, type Place, type Quote } from "@/lib/pricing";
import { formatMoney } from "@/lib/money";
import { bookSlot, type BookingResult } from "@/app/booking-actions";
import { FieldError } from "./feedback";
import { newId } from "@/lib/id";
import { directions } from "@/lib/directions";
import { useClock } from "./shop-status";
import { useLang, useT } from "./lang";

type Details = {
  day: string;
  label: string;
  where: string;
  kind: Place["kind"];
  service: string;
  quote: Quote;
  name: string;
  address: string;
};
type Confirmed = Details & { result: BookingResult };
const FIELDS = ["name", "phone", "address"] as const;
const keyOf = (place: Place) => (place.kind === "house_call" ? place.area_id : place.kind);
// A booking whose answer never arrived, kept for this tab only (see the effect below).
const pending = {
  get(key: string) {
    try {
      return JSON.parse(sessionStorage.getItem(key) ?? "null");
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
  clear(key: string) {
    try {
      sessionStorage.removeItem(key);
    } catch {}
  },
};

// Booked times come from the server and stay visible but crossed out. Always recompute
// against live hours: a stale selection must not remain actionable after the owner
// changes hours or prices, starts away mode, the slot gets booked, or the time passes.
// `uni` books one of the owner's uni visits instead of the shop or a house call.
export function CustomerTimetable({
  shop,
  hours,
  busy,
  catalog,
  initial,
  uni = false,
}: {
  shop: PublicShop;
  hours: Hours[];
  busy: Busy[];
  catalog: Catalog;
  initial: string;
  uni?: boolean;
}) {
  const lang = useLang();
  const t = useT();
  const money = (amount: number) => formatMoney(amount, shop.currency);
  const now = useClock(initial);
  const today = getShopToday(shop.timezone, now);
  const available = isShopAvailable(shop, now);
  const storageKey = uni ? "pending-uni-booking" : "pending-booking";
  const offered = (place: Place) =>
    catalog.services.filter((service) => servicePrice(service, place) !== null);
  const visitPlace = (visit: PublicVisit): Place => ({ kind: "university", visit });
  // Open visits that haven't ended and offer at least one priced service.
  const visits = uni
    ? catalog.visits.filter(
        (visit) =>
          visit.is_open && new Date(visit.ends_at) > now && offered(visitPlace(visit)).length,
      )
    : [];
  const [visitId, setVisitId] = useState(visits[0]?.id ?? "");
  const visit = visits.find((item) => item.id === visitId) ?? visits[0];
  const places: Place[] = uni
    ? visit
      ? [visitPlace(visit)]
      : []
    : [
        { kind: "shop" },
        ...catalog.areas.map((area) => ({ kind: "house_call" as const, area_id: area.id })),
      ];
  const services = catalog.services.filter((service) =>
    places.some((place) => servicePrice(service, place) !== null),
  );
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const service = services.find((item) => item.id === serviceId) ?? services[0];
  const minutes = service?.duration_minutes ?? 30;
  const servicePlaces = service
    ? places.filter((place) => servicePrice(service, place) !== null)
    : [];
  const [placeKey, setPlaceKey] = useState("shop");
  const place = servicePlaces.find((item) => keyOf(item) === placeKey) ?? servicePlaces[0];
  // One barber: a visit's whole reserved window is closed to shop and house-call times.
  const blocked = uni
    ? busy
    : [
        ...busy,
        ...catalog.visits.map((item) => ({
          slot_start: item.reserved_from,
          slot_end: item.reserved_until,
        })),
      ];
  const shopTimes = (value: string, at: Date, length: number) =>
    getPreferredTimes(shop, hours, value, at, blocked, length);
  const [chosenDay, setChosenDay] = useState(() => {
    const initialNow = new Date(initial);
    const first = getShopToday(shop.timezone, initialNow);
    return (
      Array.from({ length: 8 }, (_, offset) => shiftDay(first, offset)).find((day) =>
        shopTimes(day, initialNow, minutes).some((time) => !time.booked),
      ) || first
    );
  });
  const [chosenTime, setChosenTime] = useState<string | null>(null);
  // One id per chosen booking, reused on retry so a lost response can't double-book.
  const [bookingId, setBookingId] = useState("");
  // After a lost response the slot may show booked by our own save; keep the form so
  // the retry (same id) can confirm it.
  const [unsure, setUnsure] = useState(false);
  // Once shown, the details form stays mounted so a taken slot or a new day never
  // wipes what the customer already typed.
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  const [sending, startTransition] = useTransition();
  const slotsRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLHeadingElement>(null);
  const bookedRef = useRef<HTMLHeadingElement>(null);
  const localDay = (instant: string) =>
    formatInTimeZone(new Date(instant), shop.timezone, "yyyy-MM-dd");
  const day = uni
    ? visit
      ? localDay(visit.starts_at)
      : today
    : chosenDay < today
      ? today
      : chosenDay;
  const times = !service
    ? []
    : uni
      ? visit
        ? getVisitTimes(visit, shop.timezone, now, busy, minutes)
        : []
      : shopTimes(day, now, minutes);
  const chosen = times.find((time) => time.start === chosenTime);
  const selected = chosen && (!chosen.booked || unsure) ? chosen : undefined;
  const price =
    selected && service && place
      ? quote(service, place, catalog.extras, selected.start, shop.timezone, now)
      : null;
  const longDate = (value: string) => calendarLabel(value, "EEEE, d MMMM yyyy", lang);
  const shortDate = (value: string) => calendarLabel(value, "EEE, d MMM", lang);
  const areaName = (id: string) => catalog.areas.find((area) => area.id === id)?.name ?? "";
  const whereName = (item: Place) =>
    item.kind === "shop"
      ? t("At the shop")
      : item.kind === "house_call"
        ? t("{area} house call", { area: areaName(item.area_id) })
        : t("Uni visit");
  const week = Array.from({ length: 7 }, (_, offset) => {
    const value = shiftDay(today, offset);
    return { value, free: shopTimes(value, now, minutes).filter((time) => !time.booked).length };
  });
  const message = confirmed
    ? confirmed.kind === "university"
      ? t(
          "Hi {shop}, I’ve booked {service} at the uni visit on {date} at {time}. Name: {name}. Please confirm the haircut location.",
          {
            shop: shop.name,
            service: confirmed.service,
            date: longDate(confirmed.day),
            time: confirmed.label,
            name: confirmed.name,
          },
        )
      : t("Hi {shop}, I’ve booked {service} on {date} at {time} ({area}). Name: {name}.", {
          shop: shop.name,
          service: confirmed.service,
          date: longDate(confirmed.day),
          time: confirmed.label,
          area: confirmed.where,
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
  // A refresh while a booking was on its way: finish it with the same id, so it is
  // recognised if it already saved instead of becoming a second booking.
  useEffect(() => {
    const saved = pending.get(storageKey);
    if (saved) {
      setStarted(true);
      send(saved.input, saved.details);
    }
  }, []);

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
  // A different haircut, place or visit is a different booking: it gets a new id, and a
  // time picked for another length is picked again.
  function change(update: () => void, keepTime = false) {
    update();
    if (!keepTime) setChosenTime(null);
    setBookingId(newId());
    setUnsure(false);
    setResult(null);
  }
  function changeTime() {
    const button = slotsRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    (
      button ?? slotsRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")
    )?.focus();
  }
  function send(input: Record<string, unknown>, details: Details) {
    pending.set(storageKey, { input, details });
    startTransition(async () => {
      try {
        const response = await bookSlot(input);
        pending.clear(storageKey);
        setResult(response);
        if (response.ok) setConfirmed({ ...details, result: response });
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
  function submit(event: React.FormEvent<HTMLFormElement>) {
    // onSubmit, not a form action: React resets a form after an action, which would
    // wipe what the customer typed whenever the server asks them to fix a field.
    event.preventDefault();
    if (!selected || !service || !place || !price) return;
    const form = new FormData(event.currentTarget);
    const address = place.kind === "house_call" ? String(form.get("address") ?? "") : "";
    const input = {
      id: bookingId,
      kind: place.kind,
      slot_start: selected.start,
      service_id: service.id,
      area_id: place.kind === "house_call" ? place.area_id : null,
      visit_id: place.kind === "university" ? place.visit.id : null,
      total: price.total,
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      address,
      note: String(form.get("note") ?? ""),
    };
    send(input, {
      day,
      label: selected.label,
      where: whereName(place),
      kind: place.kind,
      service: service.name,
      quote: price,
      name: input.name.trim(),
      address: address.trim(),
    });
  }

  const contact = whatsapp ? (
    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-primary mt-6">
      <MessageCircle size={18} aria-hidden="true" /> {t("WhatsApp me")}
      <ArrowUpRight size={16} aria-hidden="true" />
    </a>
  ) : (
    <p className="mt-6 text-sm text-muted">{t("Contact details coming soon")}</p>
  );

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
        {confirmed.kind === "university" ? (
          // Saving the booking doesn't confirm the place: the customer messages the owner.
          <div className="mt-4 rounded-lg border-2 border-accent p-4">
            <p className="text-base font-semibold leading-7 text-pretty">
              {t(
                "Your booking is saved. Please confirm the haircut location with the owner via WhatsApp before your appointment.",
              )}
            </p>
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-4 w-full sm:w-auto"
              >
                <MessageCircle size={18} aria-hidden="true" /> {t("Confirm location on WhatsApp")}
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            )}
          </div>
        ) : (
          <p className="mt-2 max-w-md text-sm leading-6 text-muted text-pretty">
            {t("Your time is saved. To change or cancel it, message me on WhatsApp.")}
          </p>
        )}
        <dl className="ticket mt-6 grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("When")}</dt>
            <dd className="text-right font-semibold tabular-nums">
              {calendarLabel(confirmed.day, "EEE, d MMMM", lang)} ·{" "}
              <span className="whitespace-nowrap">{confirmed.label}</span>
            </dd>
          </div>
          {confirmed.kind !== "university" && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t("Where")}</dt>
              <dd className="text-right font-semibold">{confirmed.where}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("Name")}</dt>
            <dd className="text-right font-semibold">{confirmed.name}</dd>
          </div>
          <QuoteLines quote={confirmed.quote} service={confirmed.service} money={money} />
        </dl>
        {confirmed.kind === "shop" && (
          <div className="mt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <MapPin size={17} aria-hidden="true" /> {t("Where to find me")}
            </h3>
            <p className="mt-2 whitespace-pre-line text-sm text-muted">
              {confirmed.result.address || t("I’ll send you the location on WhatsApp.")}
            </p>
            <Directions address={confirmed.result.address} mapsUrl={confirmed.result.maps_url} />
          </div>
        )}
        {confirmed.kind === "house_call" && (
          <div className="mt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <House size={17} aria-hidden="true" /> {t("I’ll come to you")}
            </h3>
            <p className="mt-2 whitespace-pre-line text-sm text-muted">{confirmed.address}</p>
          </div>
        )}
        {whatsapp && confirmed.kind !== "university" && (
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
        {contact}
      </section>
    );

  if (!services.length)
    return (
      <section className="py-8 sm:py-10" aria-labelledby="none-title">
        <h2 id="none-title" className="section-title">
          {uni ? t("No uni visits open yet") : t("Online booking opens soon")}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted text-pretty">
          {uni
            ? t(
                "No uni visits are open for booking right now. Message me on WhatsApp to ask about the next one.",
              )
            : t("Prices are being updated. Message me on WhatsApp to book.")}
        </p>
        {contact}
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
          {uni ? t("Book a uni visit") : t("Choose your time")}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {t("Times fit the haircut you choose. Crossed-out times are taken.")}
        </p>
        {uni && (
          <p className="mt-2 text-sm text-muted">
            {t("Confirm the haircut location with the owner on WhatsApp before your appointment.")}
          </p>
        )}

        {uni && (
          <>
            <h3 className="step-label mt-6">{t("1. Choose a visit")}</h3>
            <div
              role="group"
              aria-label={t("Uni visits")}
              className="mt-3 grid gap-2 sm:grid-cols-2"
            >
              {visits.map((item) => {
                const choices = offered(visitPlace(item));
                const free = getVisitTimes(
                  item,
                  shop.timezone,
                  now,
                  busy,
                  Math.min(...choices.map((choice) => choice.duration_minutes)),
                ).filter((time) => !time.booked).length;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === visit?.id}
                    onClick={() => change(() => setVisitId(item.id))}
                    className={`rounded-lg border bg-surface p-4 text-left text-sm transition-colors ${item.id === visit?.id ? "border-accent ring-1 ring-accent" : "border-line hover:border-ink"}`}
                  >
                    <span className="block font-semibold tabular-nums">
                      {shortDate(localDay(item.starts_at))} ·{" "}
                      <span className="whitespace-nowrap">
                        {shopClock(item.starts_at, shop.timezone)}–
                        {shopClock(item.ends_at, shop.timezone)}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {choices
                        .map(
                          (choice) =>
                            `${choice.name} ${money(servicePrice(choice, visitPlace(item))!)}`,
                        )
                        .join(" · ")}
                    </span>
                    <span className="mt-1 block text-xs font-semibold">
                      {free ? t("{count} free", { count: free }) : t("Fully booked")}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <h3 className="step-label mt-6">
          {uni ? t("2. Choose a haircut") : t("1. Choose a haircut")}
        </h3>
        <div role="group" aria-label={t("Haircuts")} className="mt-3 grid gap-2 sm:grid-cols-2">
          {services.map((item) => {
            const found = priceRange(places.map((option) => servicePrice(item, option)));
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === service?.id}
                onClick={() => change(() => setServiceId(item.id))}
                className={`flex min-h-14 items-center justify-between gap-3 rounded-lg border bg-surface px-4 py-3 text-left text-sm transition-colors ${item.id === service?.id ? "border-accent ring-1 ring-accent" : "border-line hover:border-ink"}`}
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{item.name}</span>
                  <span className="block text-xs text-muted">
                    {t("{minutes} min", { minutes: item.duration_minutes })}
                    {item.description && ` · ${item.description}`}
                  </span>
                </span>
                {found && (
                  <span className="shrink-0 font-semibold tabular-nums">
                    {found.min === found.max
                      ? money(found.min)
                      : t("From {price}", { price: money(found.min) })}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <h3 className="step-label mt-6">{uni ? t("3. Choose a time") : t("2. Date and time")}</h3>
        {!uni && (
          <>
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
          </>
        )}
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
            {uni
              ? t("No times left at this visit. Choose another visit, or message me on WhatsApp.")
              : t("No times to book on this date. Choose another day, or message me on WhatsApp.")}
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
              {uni ? t("4. Your details") : t("3. Your details")}
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
            {!uni && service && (
              <div>
                <label htmlFor="booking-area">{t("Where")}</label>
                <select
                  id="booking-area"
                  name="area"
                  value={place ? keyOf(place) : ""}
                  onChange={(event) => change(() => setPlaceKey(event.target.value), true)}
                  className="mt-2"
                >
                  {servicePlaces.map((item) => {
                    const amount = money(servicePrice(service, item)!);
                    return (
                      <option key={keyOf(item)} value={keyOf(item)}>
                        {item.kind === "shop"
                          ? t("At the shop · {price}", { price: amount })
                          : t("{area} house call · {price}", {
                              area: areaName(keyOf(item)),
                              price: amount,
                            })}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            {place?.kind === "house_call" && (
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
            {price && service && (
              <dl className="ticket grid gap-2 text-sm" aria-label={t("Price")}>
                <QuoteLines quote={price} service={service.name} money={money} />
              </dl>
            )}
            {result && !result.ok && (
              <p role="alert" className="field-error">
                {t(result.message)}
              </p>
            )}
            <button
              type="submit"
              disabled={sending || !selected}
              className="btn-primary w-full sm:w-auto"
            >
              {sending ? t("Booking…") : t("Book this time")}
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
                {price && ` · ${money(price.total)}`}
              </span>
              <span className="text-xs text-muted underline underline-offset-2">
                {t("Change time")}
              </span>
            </button>
            <button
              type="submit"
              form="booking-form"
              disabled={sending}
              className="btn-primary shrink-0"
            >
              {sending ? t("Booking…") : t("Book this time")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// The service price, each extra charge that applies, and the total the customer agrees to.
function QuoteLines({
  quote,
  service,
  money,
}: {
  quote: Quote;
  service: string;
  money: (amount: number) => string;
}) {
  const t = useT();
  return (
    <>
      <div className="flex justify-between gap-4">
        <dt className="text-muted">{service}</dt>
        <dd className="text-right tabular-nums">{money(quote.price)}</dd>
      </div>
      {quote.charges.map((charge) => (
        <div key={charge.label} className="flex justify-between gap-4">
          <dt className="text-muted">{charge.label}</dt>
          <dd className="text-right tabular-nums">+{money(charge.amount)}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-4 border-t border-dashed border-line pt-2">
        <dt className="font-semibold">{t("Total")}</dt>
        <dd className="text-right font-semibold tabular-nums">{money(quote.total)}</dd>
      </div>
    </>
  );
}

function Directions({ address, mapsUrl }: { address?: string | null; mapsUrl?: string }) {
  const links = directions(address, mapsUrl);
  return links.length ? (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:flex">
      {links.map(([app, href]) => (
        <a
          key={app}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
        >
          {app} <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      ))}
    </div>
  ) : null;
}
