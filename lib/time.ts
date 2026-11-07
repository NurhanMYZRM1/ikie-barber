import { addDays, format, isMatch, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { Busy, Hours, PublicShop, PublicVisit } from "./types";
import { dateLocale, translate, type Lang } from "./i18n";

export const DEFAULT_TIMEZONE = "Asia/Kuala_Lumpur";
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The ONLY definition of 'today'. Never slice a UTC ISO timestamp to get a day.
 * Earnings filter on this date; midnight changes the filter, never deletes data. */
export function getShopToday(timezone = DEFAULT_TIMEZONE, now = new Date()): string {
  return formatInTimeZone(now, timezone, "yyyy-MM-dd");
}
// A date-only value is a calendar label, not an instant. date-fns handles its
// arithmetic without asking the host's timezone what date it is right now.
export function calendarLabel(day: string, pattern = "EEE, d MMM", lang: Lang = "en") {
  return format(parseISO(day), pattern, { locale: dateLocale(lang) });
}
export function shiftDay(day: string, count: number) {
  return format(addDays(parseISO(day), count), "yyyy-MM-dd");
}
export function weekday(day: string) {
  return Number(format(parseISO(day), "i")) - 1;
}
export function periodStarts(today: string) {
  const day = parseISO(today);
  return {
    week: format(startOfWeek(day, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    month: format(startOfMonth(day), "yyyy-MM-dd"),
  };
}
export function shopDateLabel(timezone: string, now = new Date(), lang: Lang = "en") {
  return formatInTimeZone(now, timezone, "EEEE, d MMMM yyyy", { locale: dateLocale(lang) });
}
export function shopClock(instant: string, timezone: string) {
  return formatInTimeZone(parseISO(instant), timezone, "h:mm a");
}
export function timeLabel(time: string) {
  return format(parseISO(`2000-01-01T${time.slice(0, 5)}:00`), "h:mm a");
}
export function isTimezone(value: string) {
  try {
    formatInTimeZone(new Date(), value, "yyyy-MM-dd");
    return true;
  } catch {
    return false;
  }
}
export function millisecondsUntilMidnight(timezone: string, now = new Date()) {
  const tomorrow = shiftDay(getShopToday(timezone, now), 1);
  return Math.max(1, fromZonedTime(`${tomorrow}T00:00:00`, timezone).getTime() - now.getTime());
}
/** 'Back on' means available from 00:00 on that date in the shop timezone.
 * No scheduled job or write is needed; an expired away flag is ignored on reads. */
export function isShopAvailable(
  shop: Pick<PublicShop, "is_available" | "unavailable_until" | "timezone">,
  now = new Date(),
) {
  return (
    shop.is_available ||
    Boolean(shop.unavailable_until && getShopToday(shop.timezone, now) >= shop.unavailable_until)
  );
}
// A closing time of 00:00 means midnight, so compare it as the end of the day.
const until = (time: string) => (time.slice(0, 5) === "00:00" ? "24:00" : time.slice(0, 5));
export type ShopStatus = { kind: "open" | "closed" | "away"; label: string; note?: string | null };
export function getShopStatus(
  shop: PublicShop,
  hours: Hours[],
  now = new Date(),
  lang: Lang = "en",
): ShopStatus {
  const t = (text: string, vars?: Record<string, string>) => translate(lang, text, vars);
  if (!isShopAvailable(shop, now))
    return {
      kind: "away",
      label: shop.unavailable_until
        ? t("Not available until {date}", {
            date: calendarLabel(shop.unavailable_until, "EEE, d MMM", lang),
          })
        : t("Not available until further notice"),
      note: shop.unavailable_note,
    };
  const today = getShopToday(shop.timezone, now);
  const clock = formatInTimeZone(now, shop.timezone, "HH:mm");
  const current = hours.find((row) => row.day_of_week === weekday(today));
  if (
    current?.is_open &&
    clock >= current.open_time.slice(0, 5) &&
    clock < until(current.close_time)
  ) {
    if (
      current.break_start &&
      current.break_end &&
      clock >= current.break_start.slice(0, 5) &&
      clock < current.break_end.slice(0, 5)
    ) {
      return {
        kind: "closed",
        label: t("On a break · Back at {time}", { time: timeLabel(current.break_end) }),
      };
    }
    const closes =
      current.break_start && clock < current.break_start.slice(0, 5)
        ? current.break_start
        : current.close_time;
    return { kind: "open", label: t("Open now · Closes {time}", { time: timeLabel(closes) }) };
  }
  // Include day +7 so a shop open only once a week still shows its next opening.
  for (let offset = 0; offset <= 7; offset++) {
    const day = shiftDay(today, offset);
    const row = hours.find((item) => item.day_of_week === weekday(day));
    if (!row?.is_open || (offset === 0 && clock >= row.open_time.slice(0, 5))) continue;
    const time = timeLabel(row.open_time);
    const label =
      offset === 0
        ? t("Closed · Opens today at {time}", { time })
        : offset === 1
          ? t("Closed · Opens tomorrow at {time}", { time })
          : t("Closed · Opens {date} at {time}", {
              date: calendarLabel(day, "EEE, d MMM", lang),
              time,
            });
    return { kind: "closed", label };
  }
  return { kind: "closed", label: t("Closed · Opening hours to be announced") };
}

export type PreferredTime = { start: string; label: string; booked: boolean };
const overlaps = (busy: Busy[], start: number, end: number) =>
  busy.some(
    (range) =>
      new Date(range.slot_start).getTime() < end && new Date(range.slot_end).getTime() > start,
  );

/** Half-hourly start times for a service of `minutes`, from opening time. The whole
 * appointment must fit before the break and closing. Times overlapping `busy` (other
 * bookings, visit windows) stay in the list, flagged, so the timetable can gray them out. */
export function getPreferredTimes(
  shop: PublicShop,
  hours: Hours[],
  day: string,
  now = new Date(),
  busy: Busy[] = [],
  minutes = 30,
): PreferredTime[] {
  if (!isMatch(day, "yyyy-MM-dd") || day < getShopToday(shop.timezone, now)) return [];
  if (!isShopAvailable(shop, now)) return [];
  const row = hours.find((item) => item.day_of_week === weekday(day));
  if (!row?.is_open) return [];

  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const times: PreferredTime[] = [];
  for (
    let minute = toMinutes(row.open_time);
    minute + minutes <= toMinutes(until(row.close_time));
    minute += 30
  ) {
    if (
      row.break_start &&
      row.break_end &&
      minute < toMinutes(row.break_end) &&
      minute + minutes > toMinutes(row.break_start)
    )
      continue;
    const clock = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    const instant = fromZonedTime(`${day}T${clock}:00`, shop.timezone);
    // Skip elapsed times and local times that do not exist during a DST change.
    if (
      instant <= now ||
      formatInTimeZone(instant, shop.timezone, "yyyy-MM-dd HH:mm") !== `${day} ${clock}`
    )
      continue;
    times.push({
      start: instant.toISOString(),
      label: timeLabel(clock),
      booked: overlaps(busy, instant.getTime(), instant.getTime() + minutes * 60_000),
    });
  }
  return times;
}

/** Half-hourly start times inside a uni visit's hours; the appointment must end by its end. */
export function getVisitTimes(
  visit: Pick<PublicVisit, "starts_at" | "ends_at">,
  timezone: string,
  now = new Date(),
  busy: Busy[] = [],
  minutes = 30,
): PreferredTime[] {
  const times: PreferredTime[] = [];
  const end = new Date(visit.ends_at).getTime();
  for (
    let start = new Date(visit.starts_at).getTime();
    start + minutes * 60_000 <= end;
    start += 1_800_000
  ) {
    if (start <= now.getTime()) continue;
    const iso = new Date(start).toISOString();
    times.push({
      start: iso,
      label: shopClock(iso, timezone),
      booked: overlaps(busy, start, start + minutes * 60_000),
    });
  }
  return times;
}
