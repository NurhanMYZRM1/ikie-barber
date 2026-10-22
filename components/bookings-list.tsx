"use client";
import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin, MessageCircle, X } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { deleteBooking } from "@/app/admin/actions";
import type { ActionResult, Booking } from "@/lib/types";
import { Feedback } from "./feedback";
import { useLang, useT } from "./lang";
import { dateLocale } from "@/lib/i18n";
import { directions } from "@/lib/directions";

// Customer bookings. Cancelling deletes the row, which frees the slot, so past
// bookings are shown read-only to keep the history.
export function BookingsList({
  bookings,
  timezone,
  title = "Upcoming bookings",
  empty = "No upcoming bookings. They appear here as customers book.",
  cancellable = true,
  moreHref,
}: {
  bookings: Booking[];
  timezone: string;
  title?: string;
  empty?: string;
  cancellable?: boolean;
  moreHref?: string;
}) {
  const titleId = useId();
  const lang = useLang();
  const t = useT();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <section aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-4">
        <h2 id={titleId} className="text-lg font-semibold">
          {t(title)}
        </h2>
        {moreHref && (
          <Link href={moreHref} className="btn px-0 text-sm text-muted">
            {t("See all bookings")}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        )}
      </div>
      {result && (
        <div className="mt-3">
          <Feedback result={result} />
        </div>
      )}
      {bookings.length ? (
        <ul className="card mt-3 divide-y divide-line">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm sm:flex-nowrap"
            >
              <div className="min-w-0 basis-full py-1 sm:flex sm:flex-1 sm:basis-auto sm:items-baseline sm:gap-4">
                <p className="shrink-0 font-semibold tabular-nums sm:w-40">
                  {formatInTimeZone(new Date(booking.slot_start), timezone, "EEE, d MMM · h:mm a", {
                    locale: dateLocale(lang),
                  })}
                </p>
                <div className="min-w-0">
                  <p>
                    {booking.name} ·{" "}
                    {booking.area === "Shop"
                      ? t("At the shop")
                      : t("{area} house call", { area: booking.area })}
                  </p>
                  {booking.address && (
                    <p className="mt-1 flex gap-1 whitespace-pre-line text-muted">
                      <MapPin size={15} aria-hidden="true" className="mt-0.5 shrink-0" />{" "}
                      {booking.address}
                    </p>
                  )}
                  {booking.address && (
                    <div className="flex gap-4">
                      {directions(booking.address).map(([app, href]) => (
                        <a
                          key={app}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={t("{app} directions to {name}", { app, name: booking.name })}
                          className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent"
                        >
                          {app} <ArrowUpRight size={15} aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  )}
                  {booking.note && <p className="mt-1 text-muted">“{booking.note}”</p>}
                </div>
              </div>
              <a
                href={`https://wa.me/${booking.phone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 font-semibold tabular-nums text-accent"
              >
                <MessageCircle size={16} aria-hidden="true" /> +{booking.phone}
              </a>
              {cancellable && (
                <button
                  type="button"
                  disabled={pending}
                  aria-label={t("Cancel booking for {name}", { name: booking.name })}
                  className="btn ml-auto shrink-0 px-3 text-muted"
                  onClick={() => {
                    if (
                      !window.confirm(
                        t("Cancel {name}’s booking? The slot becomes free.", {
                          name: booking.name,
                        }),
                      )
                    )
                      return;
                    startTransition(async () => setResult(await deleteBooking(booking.id)));
                  }}
                >
                  <X size={16} aria-hidden="true" /> {t("Cancel")}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="card mt-3 px-4 py-3 text-sm text-muted">{t(empty)}</p>
      )}
    </section>
  );
}
