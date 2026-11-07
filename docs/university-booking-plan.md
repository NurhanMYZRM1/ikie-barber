# University bookings and owner-managed services

Status: Implementation complete and release authorized by the owner, including the university location removals.

Updated location decision: all university locations must be agreed directly with the owner on WhatsApp. The public pages and owner dashboard do not show or collect a general meeting area, meeting spot, or map link; no proposed location is included in confirmation or prepared messages. Individual home visits use house-call bookings. House-call prices are set per service and area. Rule-based extras are included before booking; extras without rules are arranged through WhatsApp. Away mode pauses all new bookings, visits may run outside weekly shop hours, and starts stay on the half-hour grid.

## Objective

Extend Ikie Barber so the owner can organise visits for Universiti Islam Selangor (UIS) students, move between meeting points, and manage haircut services and prices without editing code. Keep shop and house-call bookings available and coordinate all appointments through one calendar.

## 1. Public university section

- English title: **For uni students**.
- Malay title: **Untuk pelajar universiti**.
- Serve UIS students without a university selector, customer account, or student-ID upload.
- Show upcoming visits with their date, operating hours, available services, prices, and available appointments. Locations are confirmed directly with the owner.
- If no visits are available, explain this clearly and offer the owner's WhatsApp contact link.
- Support mobile and desktop layouts, BM/EN, and the existing light/dark appearance.

### Booking flow

1. Choose a university visit.
2. Choose a haircut/service and see its price and duration.
3. Choose an available time that fits the full service duration.
4. Enter name, WhatsApp number, and an optional note.
5. Submit the booking and display confirmation with the service, agreed price, appointment date/time, and a request to confirm the location directly with the owner.
6. Prompt the customer to confirm the location with the owner through WhatsApp.

### WhatsApp location confirmation

After a successful university booking, prominently display:

**English message:**

> Your booking is saved. Please confirm the haircut location with the owner via WhatsApp before your appointment.

**English button:** Confirm location on WhatsApp

**Malay message:**

> Tempahan anda telah disimpan. Sila sahkan lokasi potong rambut dengan pemilik melalui WhatsApp sebelum waktu temujanji anda.

**Malay button:** Sahkan lokasi melalui WhatsApp

The link uses the owner's WhatsApp number stored in Supabase. It opens a prepared message in the customer's selected language containing their name, service, appointment date and time, and a request to confirm the location. Do not include a proposed meeting point. The customer sends the message themselves.

The booking is saved before WhatsApp opens. Opening WhatsApp does not count as sending a message or confirming a location; the site must not claim either happened. Require a valid owner WhatsApp contact before publishing a university visit so this step is always available.

## 2. Owner-managed university visits

Add a university-visits management page to the dashboard. The owner can create, edit, duplicate, and pause visits.

Each visit contains:

- Date, start time, and end time.
- No location fields; the owner arranges every location directly with the student.
- Available services and applicable prices.
- Travel/setup time reserved before and after the visit.
- Status controlling whether new bookings are accepted.

Duplicating a previous visit reuses its services, prices, and buffer settings while allowing the owner to change the date quickly.

Pausing stops new bookings and preserves existing appointments. Cancelling a whole visit requires the owner to review and resolve affected bookings first.

The owner uses individual customer WhatsApp links to arrange or change locations directly. Historical location data is retained in existing records but is not shown in the university interface.

## 3. Services and prices

Add a **Services & prices** dashboard page. The owner can:

- Add haircut types with a name, description, price, and duration.
- Edit services and prices at any time.
- Make a service available for shop appointments, house calls, university visits, or a combination.
- Set applicable prices by booking type, house-call area, or university visit.
- Manage extra charges, including any time-based or urgent-booking charges.
- Hide a service without deleting historical booking records.

Define a clear price precedence during implementation: a visit-specific price overrides the service's university price; otherwise use the applicable service/area price. Show all applicable charges and the final agreed amount before submission. Unpriced exceptions require contacting the owner rather than silently adding a charge after booking.

Customers select a service before a time. The full service duration determines availability; the current 30-minute haircut can be the initial service, but duration is owner-editable.

Replace the hardcoded public price list with backend-managed services and pricing. Public summaries and booking forms must use the same data.

## 4. Shared scheduling

Use one calendar for the single barber across shop, house-call, and university bookings.

- Reserve an entire university visit window, including travel/setup buffers, against shop appointments, house calls, and other visits.
- Allow university bookings within that visit's service window, excluding buffers.
- Reject new visits that conflict with existing appointments and show the conflicts to the owner.
- Check full appointment intervals, not only equal start times, so longer services cannot overlap another booking, a break, or the end of a visit.
- Validate availability and prevent concurrent overlapping reservations in the database as well as the interface.
- Reconcile visits with shop away mode and schedule rules explicitly; the owner must be able to see which times are bookable and why.
- Preserve existing reservations when availability, service duration, prices, or visit settings change. Block schedule edits that would invalidate appointments until the owner resolves them.

## 5. Backend storage and access

All owner-editable business data must be stored in Supabase and used by both the public website and owner dashboard:

| Data              | Includes                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Services          | Names, descriptions, durations, visibility, booking-type availability                                                  |
| Pricing           | Base prices, area/type pricing, visit overrides, extra charges                                                         |
| University visits | Dates, meeting areas, exact locations, map links, hours, buffers, status                                               |
| House-call areas  | Available areas and applicable pricing                                                                                 |
| Shop settings     | Name, logo, contact information, address, opening hours, breaks, timezone, currency, away status                       |
| Bookings          | Customer details, booking type, linked visit/service, appointment start/end, agreed price and charges, booked location |
| Earnings          | Amounts, payment methods, notes, business dates, history                                                               |

Static interface text can remain in the translation files. Owner-controlled business values must not be hardcoded in components or source-code enums.

Each booking keeps a snapshot of its service name, agreed price/charges, duration, and location. Later edits to the service catalogue or prices apply to new bookings without rewriting existing agreements.

Require owner authentication for management actions. Use database permissions and row-level security to protect customer details and earnings. Public reads expose only the information needed to browse services and availability; exact meeting directions are supplied after booking. Owner updates persist across devices and appear without redeployment.

## 6. Existing dashboard integration

- Show university bookings alongside shop and house-call appointments on Home and Bookings.
- Clearly label appointment type, service, time, and location.
- Include customer WhatsApp links and cancellation controls.
- Keep past bookings available as records.
- Keep earnings manually recorded; booking a haircut does not automatically record payment or revenue.

## 7. Implementation sequence after review

1. Finalise the remaining location question and scheduling details.
2. Design database migrations for services, prices, areas, visits, buffers, and booking snapshots. Inspect the existing legacy services table before deciding how to reuse it. Preserve existing bookings and earnings; do not invent historical agreed prices.
3. Implement database access rules, interval-conflict protection, and validated server actions.
4. Build Services & prices and university-visit management, including duplication and pause controls.
5. Replace hardcoded pricing and extend the public booking flow with service selection and the university section.
6. Add confirmation-screen WhatsApp location prompts and owner location-update links in BM/EN.
7. Integrate the new bookings with the existing dashboard and update project documentation.
8. Run focused automated checks and review mobile/desktop behaviour before presenting the completed work for review. Do not commit without user approval.

## 8. Acceptance checks

- An owner can add a haircut, change its price/duration, and publish it without editing code or redeploying.
- The owner can quickly duplicate a university visit without entering a location.
- University visits and their buffers cannot overlap other commitments.
- Concurrent requests cannot reserve overlapping appointments.
- A longer service fits entirely within available time and respects breaks.
- Price/service edits do not alter existing bookings' agreed details.
- Pausing preserves bookings; cancelling or editing occupied visits surfaces affected customers.
- Successful university bookings show the required WhatsApp location-confirmation message and button in BM/EN.
- The WhatsApp link targets the configured owner and contains the correct customer, service, date, time, and location-confirmation request.
- Refreshes and retry attempts do not create duplicate bookings.
- Public users cannot read private booking details or earnings or change owner-managed data.
- Existing shop/house-call flows, earnings history, and timezone behaviour continue to work.
- Mobile, desktop, keyboard interaction, BM/EN, and light/dark states are checked.

## 9. Scope and agreed location model

Initial scope excludes student accounts, student-ID verification, demand polls, waitlists, deposits, automatic message sending, and automated reminders.

**Agreed:** all university locations are confirmed directly with the owner through WhatsApp. No visit location is entered or displayed in the app. Students who need a visit at their own place use house-call bookings.

## 10. Local delivery and rollout

The implementation includes `/uni`, `/admin/services`, and `/admin/visits`, a reusable catalogue, service-duration availability, database pricing and overlap protection, immutable booking agreements, refresh-safe retries, and BM/EN location confirmation. The draft migration is `supabase/migrations/20261107090000_services_and_uni_visits.sql`. README.md contains setup and owner workflows.

Local tests use real Postgres through PGlite and a local Supabase HTTP stand-in. Hosted Supabase Auth, Realtime, project grants, and the migration must still be verified on the target project before launch. The owner has authorized committing, opening a pull request, and deploying this version live.
