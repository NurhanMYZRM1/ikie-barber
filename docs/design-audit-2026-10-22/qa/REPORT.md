# Design pass — QA report (22 October 2026)

All interaction checks ran against the in-memory test database (`tests/fixtures/supabase-server.mjs`) on an isolated dev server (port 3200, build dir `.next-qa`). No real bookings, settings or earnings were touched; no WhatsApp or Instagram messages were sent.

`before/` and `after/` were captured with the same script at the same widths, so file names pair up (e.g. `before/public-375.png` ↔ `after/public-375.png`). `report.json` in each folder holds the measurements.

## Design decisions

- **Public page = a barber's poster, not a landing page.** Kept the logo, Oswald, monochrome palette and slogan; shortened the hero and added one always-on service line (shop or house call in Putrajaya, Cyberjaya, Bangi) so an empty description no longer leaves only the slogan.
- **Prices before commitment.** Phones get a two-line price summary in the hero (shop RM8 / RM10, house call RM20–RM35, straight from `PRICES`); desktop shows the full price list in a sticky right column beside booking.
- **Two clear steps.** "1. Date and time" (7-day chips reusing `getPreferredTimes`, plus the existing date input with the 30-day range) and "2. Your details" with a dashed "ticket" summary of the chosen time that echoes the dashed price rows.
- **Sticky bar on phones only**, showing the chosen date/time (tap to change) and Book. It hides while a field is focused so the keyboard never covers inputs; the form keeps its own Book button.
- **Honest states.** Away mode says "Booking is paused" with the WhatsApp action (or "Contact details coming soon"); "Closed now · opens today" still lets people book future slots. Confirmation says the slot is saved and WhatsApp is for changes, with directions only for shop visits and the customer's own address for house calls.
- **Owner workspace stays quiet and dense.** Upcoming bookings first, today's earnings prominent with week/month as small tiles, one-line empty states, availability grouped with the customer-facing status.

## Fixes beyond the audit (found during QA)

- The booking form used a React form action, which **cleared every typed field** after a server error (e.g. a bad phone number). Switched to `onSubmit`; regression test added.
- After a double-booking clash the taken slot still looked free until the 30-second refresh. The server now refreshes booked times on a clash, and the details form stays mounted so the customer's name and number survive.
- Screen-reader text inside the day chips widened the page to 433px on phones; contained it.

## Checks

| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` | 59 / 59 pass (6 files) |
| `npm run test:e2e` | 11 / 11 pass (4 new: away-mode messaging, field error focus/association and kept input, sidebar containment at 1024/1440 in EN and BM, clash handling) |
| `npm run build` (`NEXT_DIST_DIR=.next-build`) | Compiled successfully |
| Prettier | All files formatted |
| Horizontal overflow at 320 / 375 / 768 / 1024 / 1440 and 640×400 (200% zoom of 1280×800) | None |
| Sidebar language switch (was x=302 in a 256px sidebar) | Ends at x=114, inside at 1024 and 1440, EN and BM |
| Booking heading / price info at 375 | Booking y=618 (fold 812); price summary in hero ≈ y=420 (was 1078) |
| Booking vs prices at 1440 | Side by side at y=463 (was 585 vs 1178) |
| Keyboard | Skip link → header → day chips → date → slots; Enter selects without scrolling, visible focus ring, live "Selected … Your details are next.", Tab continues to the name field |
| Reduced motion | No transitions on buttons/links |
| Phone sticky bar (iPhone 13 emulation) | Shown after selection, hidden while a field is focused, "Change time" returns focus to the chosen slot |
| States exercised | Available, closed-now/future-open, away, no slots on a day, booked slot, selected, shop and house-call details, server validation, duplicate-slot clash, success (shop and house call), owner Home/Hours/History/Settings/login/earnings dialog |

## Not covered

- No automated accessibility scanner was run: axe-core isn't installed and no new dependencies were added. Keyboard, focus, labels and contrast were checked by hand and with scripts; a clean scan wouldn't prove full accessibility anyway.
- Not tested with a real phone keyboard or real screen readers. The keyboard-overlap behaviour was checked with iPhone 13 emulation.
- The "pending" state ("Booking…" on a disabled button) is in code and in the existing flow but wasn't captured in a screenshot; requests complete too fast locally.
- Nothing ran against the hosted Supabase project.
