# Aqil Barber

A mobile-first website and private workspace for one barbershop owner. Customers choose a service, see its price and duration, then book a shop appointment, house call, or UIS university visit without creating an account. The owner manages services, prices, house-call areas, university visits, and the shop schedule, and records earnings manually.

Built with **Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase, date-fns, date-fns-tz, and lucide-react**. No paid APIs, UI framework, email delivery, or scheduled jobs are required.

## Start here

You can preview the design without an account:

```bash
npm install
npm run dev
```

Open **http://localhost:3000** in your browser. Without Supabase environment variables, the public page displays a clearly labelled, read-only sample. The owner dashboard stays disabled. No sample financial data or authentication bypass exists.

For a working shop, follow steps 1–7 below. You do not need Docker or the Supabase CLI.

**Hosting constraint:** Vercel's free Hobby plan is for personal, non-commercial use. It can host an eligible learning/demo project, but a real operating barber shop is commercial. This means “free hosting” and “Vercel only” cannot both be promised for the live business. The code is Vercel-compatible; choose an appropriate hosting plan/provider before commercial launch. Nothing in this project purchases a plan. See [Vercel's Hobby terms](https://vercel.com/docs/plans/hobby).

## 1. Install the tools on your computer

1. Install **Node.js 22 LTS or a newer supported LTS** from [nodejs.org](https://nodejs.org/). Node runs the website's development tools. npm, its package manager, comes with it.
2. Open the project folder in a code editor such as VS Code.
3. Open the editor's Terminal. A terminal runs commands; type each command and press Enter.
4. Check that the terminal is in the project folder (the one containing `package.json`). Run `node --version` and `npm --version` to confirm installation.
5. Run `npm install` once. It downloads the project's dependencies. Keep `package-lock.json`; it records exact versions so other computers install the same code.

## 2. Create your free Supabase project

Supabase provides the database and owner login. Think of the database as a spreadsheet with stronger rules about who can read or change each row.

1. Create an account at [supabase.com](https://supabase.com/) and open the dashboard.
2. Create an organization on the **Free** plan, then choose **New project**.
3. Give it a name, such as `aqil-barber`. Choose a region close to the shop (Singapore is suitable for Malaysia).
4. Create a strong **database password**, store it somewhere safe, and wait for the project to finish preparing. This password is different from your shop owner's login password.
5. Do not enable paid add-ons. Free-tier quotas and inactivity rules can change; check your project's dashboard before launch. Keep backups of your earnings.

## 3. Create the tables and security rules

A migration is a text file of SQL instructions that creates database tables, validation rules, and permissions.

1. In your Supabase project, open **SQL Editor → New query**.
2. In this project, open `supabase/migrations/20261021162754_initial_shop.sql`.
3. Copy **the entire file**, paste it into the SQL Editor, and click **Run**. Run this migration once on a fresh project. If it fails, resolve the error before continuing; do not ignore a partially applied migration.
4. Start another query. Copy the entire contents of `supabase/migrations/20261022090000_bookings.sql`, paste, and run. Then do the same with `supabase/migrations/20261022100000_bookings_privileges.sql`: Supabase gives visitors full access to new tables by default, and this removes it so they can see booked times but never names, phones or addresses. It adds customer bookings and allows a midnight (00:00) closing time.
5. Run `supabase/migrations/20261022120000_private_shop_address.sql`, then `supabase/migrations/20261107090000_services_and_uni_visits.sql`, each once and in that order. These protect private directions, reuse the legacy services table, seed the initial real price list, and add visits, booking snapshots, and interval conflict protection. On an existing project, run only migrations it has not already applied. Existing bookings and earnings are preserved; old bookings have no recorded agreed price.
6. Run `supabase/seed.sql`. It fills missing shop settings and weekly hours without overwriting owner edits. Check that `shop_settings` has one row and `weekly_hours` has all seven weekdays.

The sample schedule is daily, 3 PM–midnight, with a 6:30–8 PM break. Replace the placeholder address and add a real contact number in Settings after login. There are no fake earnings or owner passwords in the seed.

The migration also adds the public tables to `supabase_realtime` when that publication exists. This lets an already-open visitor page refresh after an owner edit. The app also refreshes every 30 seconds and on returning to a browser tab, as a fallback. Only the public profile and hours are subscribed to; earnings are not published.

## 4. Create exactly one owner account

There is deliberately **no sign-up page**.

1. In Supabase, go to **Authentication → Users → Add user → Create new user**.
2. Enter the owner's email and a strong password. Enable **Auto Confirm User** so no email delivery service is required.
3. Copy the new user's **User UID** (a UUID containing letters, numbers, and dashes).
4. In SQL Editor, run this, replacing the placeholder with that exact UID:

   ```sql
   insert into private.shop_owner (singleton, user_id)
   values (true, 'PASTE-THE-OWNER-USER-UID-HERE');
   ```

5. In **Authentication → Sign In / Providers** (the labels may vary), turn **Allow new users to sign up OFF**. Also keep anonymous sign-ins and unused providers disabled. Email/password sign-in stays enabled.

The private owner table permits only one row. Another authenticated account is **not** an owner. If you replace the owner later, update this row manually in the SQL Editor rather than adding a second one. Never place the owner's password in a source file; it lives only in Supabase Auth.

Forgot the owner password? Use Supabase's dashboard/admin recovery tools to update that manually created account. This MVP intentionally has no email-reset delivery flow.

## 5. Connect the website to Supabase

1. In Supabase, open your project's **Connect** dialog or **Project Settings → Data API** and copy the **Project URL**.
2. In **Project Settings → API Keys**, copy a **publishable key** (`sb_publishable_…`). Do **not** copy a secret or `service_role` key.
3. In this project's root folder, copy `.env.example` to a new file named `.env.local`. On macOS/Linux you can run:

   ```bash
   cp .env.example .env.local
   ```

4. Fill in the values:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
   OWNER_USERNAME=the-login-id-the-owner-will-type
   OWNER_EMAIL=the-owner-email-from-step-4
   ```

   The owner signs in at `/admin/login` with that ID and the password of the Supabase account from step 4. To change the password, update that user in Supabase (**Authentication → Users**); it is never stored in this project.

5. Save the file. Stop the development server with **Ctrl+C**, then run `npm run dev` again. Environment variable changes require a restart.

**Owner login is not linked from the public page.** The owner bookmarks `/admin`, which opens the login screen when signed out. A wrong ID and a wrong password show the same message. `OWNER_USERNAME` and `OWNER_EMAIL` are server-only; never prefix them with `NEXT_PUBLIC_`.

`NEXT_PUBLIC_` means a value may be visible to browsers. The publishable key is safe for this purpose because the database enforces Row Level Security (RLS). A secret/service-role key would bypass those protections and must never be used here. `.env.local` is ignored by Git.

## 6. Run and use your shop

```bash
npm run dev
```

Open:

- **http://localhost:3000** — shop and house-call bookings.
- **http://localhost:3000/uni** — UIS visits and student bookings.
- **http://localhost:3000/admin** — the owner dashboard (not linked from the shop). Redirects to the login screen until signed in.

On a phone, use your computer's local network address with port `3000` while both devices are on the same trusted Wi-Fi. Your computer's firewall must allow the local development server. This is for local testing, not hosting your live business.

After signing in:

1. **Settings:** replace the sample profile, address, and photo URL. The WhatsApp number must include the country code and digits only, e.g. `60123456789`. A direct public HTTPS image URL and Instagram link are optional. Google Maps should be an HTTPS share link. The shop name, house-call coverage, and Instagram link on the public page follow these saved values.
2. **Hours:** tap a day, choose whether it is open, then set opening/closing times. Times use 15-minute increments. An optional break must fit entirely inside the open interval. Midnight closing is supported; overnight hours are not. Edits that would invalidate a future appointment are blocked until you resolve that booking. Timezone changes are blocked while future bookings or visits remain.
3. **Home:** tap the availability switch to turn on away mode. The return date and note are optional. Save to apply it. Tap the switch again to make the shop available.
4. **Home → Add earnings:** type an amount, then Save. Note and payment method are optional. Tap an existing entry to edit it; deleting requires confirmation.
5. **History:** see the last seven days, week/month totals, and past daily entries. Tap a day to edit its entries.

6. **Settings → Services & prices:** add or edit services, their durations, shop prices, university prices, and prices for each house-call area. A blank price means the service is not offered there. Hide services or areas to stop new bookings while keeping historical agreements. Set optional extra-charge rules by appointment time or booking notice; charges without a rule are listed for WhatsApp arrangements and never silently added online.
7. **Bookings → Uni visits:** create a visit with a date, hours, offered services, and travel/setup buffers. University locations are agreed directly with the owner on WhatsApp; no general meeting area, meeting spot, or map link is entered or displayed in the visit manager. A visit price overrides the service’s university price; blank uses the university price. A valid owner WhatsApp number is required to open a visit. Duplicate a visit to reuse its settings. Pausing stops new bookings while retaining the reserved window and all existing appointments. Cancel its bookings individually before cancelling the whole visit. Use each customer’s WhatsApp link to arrange or confirm the location directly.

On phones the five tabs are at the bottom; at widths of 1024px or more, they move to the left sidebar. Sign out from Settings on mobile. The interface follows your device's light/dark setting.

## 7. Verify it before relying on it

Run the automated checks:

```bash
npm test
npm run typecheck
npm run build
```

`npm test` covers timezone/day boundaries, breaks, away-mode expiry, money input, and **actual Postgres RLS** through PGlite. Auth identity is simulated in those database tests; database policies, triggers, grants, and SQL are not mocked.

For automated browser tests:

```bash
npx playwright install chromium
npm run test:e2e
```

Stop `npm run dev` first, since Next's development/build output folder cannot be safely shared between simultaneous processes. The tests start isolated processes on ports **3100** and **54329**. They use a local, test-only Supabase HTTP stand-in with real Postgres underneath. They cover mobile login, access protection, earnings, hours, away mode, settings, service/price edits, shared availability, university visits, and BM/EN WhatsApp location confirmation. Screenshots are saved to `test-results/`. They do **not** verify Supabase's hosted Auth service, hosted Realtime, or your cloud configuration. The stand-in is never imported by the application.

Also verify your real Supabase project:

1. Sign in at `/admin/login` and save one test earnings entry.
2. Confirm that the owner dashboard shows it.
3. Run this logged-out API check:

   ```bash
   npm run verify:rls
   ```

   It should print PASS: public browsing works while shop directions, exact university meeting points, customer details, earnings, and owner writes remain protected.

4. Open the shop in a private/incognito browser. Confirm it shows the timetable and opening hours, and `/admin` redirects to the login screen.
5. Turn on away mode without a return date. The private browser should show **Not available until further notice** and the note.
6. Make the shop available again. Check that hours edits reach the visitor page and that the timetable excludes breaks. Book a test appointment and check the saved confirmation and prepared WhatsApp message. Also check a university booking in BM and EN: it must ask the student to confirm the location on WhatsApp, with the correct owner number, student name, service, date, time, and a location-confirmation request, with no proposed location.
7. Check that editing an entry updates its total, and cancelling a delete confirmation preserves it.
8. Remove the test entry through the dashboard when done.

Do not test privacy by querying as `postgres` in SQL Editor: that role bypasses RLS. The included RLS tests deliberately switch into `anon`, a different signed-in user, and the allowed owner.

## Why earnings “reset” without losing history

Every earning has two different date fields:

- `created_at`: the actual instant it was recorded.
- `business_date`: the shop's calendar date at that instant, such as `2026-10-22`.

For Kuala Lumpur, 16:30 UTC is already 00:30 the next day. `lib/time.ts → getShopToday()` always uses the **shop's timezone**, never the server's timezone, to decide what today means. A database trigger independently stamps the same business date using trusted database time and the saved timezone.

Today's total filters by `business_date = getShopToday(...)`. At shop midnight, that filter points to the new day and shows RM 0.00 until the first entry. A live clock clears the old entries immediately, a midnight timer reloads the data, and returning to a sleeping tab refreshes it too. Yesterday's rows remain unchanged and appear in History. **There is no midnight DELETE and no cron job.** Editing an entry never changes its original business date.

Week totals start on Monday. Month totals start on the first calendar day. SQL aggregates daily totals and the app pages through query results, avoiding Supabase's default per-response row cap.

Choose timezone/currency before real use. Changing timezone affects **future** entries; existing business dates remain fixed. Currency is a display/denomination setting: changing it relabels historical earnings values without converting them. This MVP does not support mixed-currency accounting.

“Back on 3 November” means available again from **00:00 on 3 November in the shop timezone**, then normal opening hours apply. The stored away flag does not need a scheduled reset: reads ignore it once its return date arrives.

## Deploy a personal demo to Vercel

The following uses an eligible free personal/demo project. Recheck [Vercel's current plan rules](https://vercel.com/docs/plans/hobby) before using this for a real business; the free Hobby plan is not commercial hosting.

1. Create a free GitHub account and a **private repository**. Use GitHub Desktop to add this project folder and publish it. Include the source, migrations, and `package-lock.json`. Do not upload `.env.local`, `node_modules`, `.next`, or test reports; `.gitignore` already excludes them.
2. Create a Vercel account and choose **Add New → Project**. Connect GitHub and import the repository.
3. Vercel should detect **Next.js**. Keep the root directory as the project root. The build command is `npm run build`; leave the output-directory default alone.
4. Select a supported Node.js LTS runtime, version 22 or newer.
5. Before deploying, add the two environment variables from step 5. Use your real project's URL and **publishable** key. Enable them for the environments you intend to use (Production/Preview/Development). Never add a privileged key.
6. Click **Deploy**. When it succeeds, open the provided `.vercel.app` URL. No purchased domain is required.
7. In Supabase **Authentication → URL Configuration**, set **Site URL** to that HTTPS URL. This MVP uses password sign-in with no email callback route; do not add public sign-up or reset redirects without implementing their handlers.
8. Repeat the real-project checks in step 7 on the deployed site, including a private-browser test.

Later code changes deploy when pushed to GitHub. Hours, earnings, and profile updates are database changes and **do not need a redeploy**. If environment variables change in Vercel, redeploy to apply them. Use a separate Supabase project for experimentation if you do not want preview builds to share live records.

## Where things live

```text
app/page.tsx                         Public shop and house-call bookings
app/uni/page.tsx                     University visits and student bookings
app/admin/login/                    Owner ID/password login and its server action
app/admin/(dashboard)/              Protected pages and mobile/desktop shell
  page.tsx                          Today's earnings and availability
  bookings/page.tsx                  Upcoming and past bookings
  services/page.tsx                  Services, prices, house-call areas and extras
  visits/page.tsx                    University visits and affected customers
  hours/page.tsx                     Weekly schedule
  history/page.tsx                   Totals and past days
  history/[date]/page.tsx            Entries on one date
  settings/page.tsx                  Profile and preferences
app/admin/*-actions.ts               Validated server-side writes
components/                         Small UI pieces and forms
lib/time.ts                         All calendar, timezone, hours/away logic
lib/money.ts                        Currency display and integer-cent sums
lib/pricing.ts                      Service/visit price precedence and extra-charge quotes
lib/auth.ts                         Server-side owner authorization
lib/data.ts                         Database reads and pagination
lib/validation.ts                   Shared Zod validation
lib/supabase/                       Cookie-aware clients and connection settings
middleware.ts                       Sends every /admin route except login to the login screen
supabase/migrations/                 Database schema, constraints and RLS
supabase/seed.sql                    Initial public sample data
tests/                              Unit, Postgres, and browser tests
scripts/verify-rls.mjs               Logged-out check against your hosted database
```

The parentheses in `(dashboard)` make a Next.js **route group**. They keep the login page outside the protected sidebar layout. They do not appear in URLs: the Home URL is still `/admin`.

## Security and small implementation choices

- All writes use Server Actions, validate input, and verify the allowed owner. Middleware is an additional navigation guard. RLS remains the final boundary even if someone calls Supabase directly.
- `private.shop_owner` contains the only allowed owner UID. It is not in an exposed API schema and uses its own RLS. Column grants hide the shop address and map link from anonymous readers; university meeting directions are protected the same way.
- Anonymous visitors can read the shop profile and hours, but see zero earnings rows. A different logged-in account also sees zero earnings. No service-role key is used. Carefully scoped security-definer functions check owner identity, stamp trusted booking details, and return directions to the holder of a saved booking ID. Their search paths are fixed; ordinary management writes use owner RLS.
- Native `<dialog>` supplies keyboard focus trapping and Escape handling for earnings sheets. Native time inputs improve mobile reliability.
- **Zod** is the extra runtime dependency for server validation; TypeScript alone cannot validate requests sent over a network. **@supabase/ssr** manages secure request-specific cookie sessions. **server-only** prevents database helpers from accidentally entering client bundles.
- **Vitest**, **PGlite**, **Playwright**, and **Supabase CLI** are development tools, not paid services. PGlite lets you verify real Postgres RLS without Docker. The CLI is available for later migrations; beginners can use SQL Editor as above.
- **Prettier** is a development-only code formatter to keep the source readable. Run `npm run format` after edits.
- Tailwind's PostCSS plugin is a build tool. The PostCSS override keeps Next.js 15 on a patched compatible PostCSS release without switching your requested Next.js major version.
- To rebrand, change `theme.extend.colors.accent` in `tailwind.config.ts` and set your shop name/photo in Settings. No external fonts are required.

## Troubleshooting

- **“One-time setup needed”:** both `.env.local` values must be filled. Restart the dev server after saving.
- **“That ID or password isn’t right”:** check `OWNER_USERNAME` and `OWNER_EMAIL` (restart after editing), the password on that Supabase user, Auto Confirm, and the UUID in `private.shop_owner`. Do not enable signup as a workaround.
- **“Could not load” or SQL permission errors:** run the full migration and seed on the correct project. The migration includes table grants as well as RLS policies.
- **Changes appear after a delay:** verify the public tables are enabled for Realtime in Supabase. The fallback refresh is 30 seconds; a fresh navigation also reads current data.
- **Blank earnings after changing timezone:** check the selected business date. Historical entries keep their original dates and remain in History.
- **Connection errors after inactivity:** check whether Supabase paused the free project, and restore it in the dashboard if needed.
- **Port already in use:** stop the other server, or run `npm run dev -- --port 3001` and use that port in the browser.
- **Photo not loading:** use a direct public HTTPS image URL, not a private file or an entire website page.

## Scope and verification limits

Core MVP features are implemented. The app can be built and tested locally without cloud credentials. Hosted Supabase Auth, hosted Realtime, and the final deployment must be verified after you create and connect your own project. A successful local test does not claim a deployment happened.

**Customer bookings:** customers choose a service before a half-hour start time. The whole service duration must fit within opening hours or the chosen university visit, without overlapping a break or another appointment. Shop/house-call dates extend 30 days ahead; university bookings follow published visits. A visit reserves its entire window, including buffers, against other appointments even when paused. Away mode pauses all new bookings; visits can otherwise run outside weekly shop hours.

The database computes each new booking’s service, end time, base price, applicable extras, final total, and location snapshot, and rejects stale price quotes. Interval exclusion constraints prevent overlapping appointments and visits; shared transaction locks protect booking/visit/schedule checks. Catalogue edits affect new bookings only. Earlier bookings keep unknown prices rather than invented historical amounts. An unchanged booking ID survives a lost response and refresh through sessionStorage so retries do not create another reservation.

Visitors can read busy intervals but no customer details. Shop directions are returned only after a saved shop booking. University bookings do not return or display directions; confirmation prompts the student to agree on the location through the configured owner’s WhatsApp; opening that prepared message neither sends it nor confirms a location. Earnings remain manual. There is no anti-spam: anyone can reserve a free appointment, and the owner cancels fakes.

**Local preview with a working database:** `node tests/fixtures/supabase-server.mjs` plus `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test-publishable-key npx next dev` runs the app against an in-memory test database (data resets on restart). Run the stand-in with `node --env-file-if-exists=.env.local` so it accepts `LOCAL_OWNER_PASSWORD` from `.env.local` for the owner login (local preview only). Actual earnings remain manual. The MVP excludes payments, SMS, staff accounts, customer accounts, and multiple locations.

Design follows the written patterns supplied with the brief: compact weekly hours, expandable day editing, earnings summaries, daily history, and a calm sidebar. The provided Mobbin screen links were not accessible during implementation.
