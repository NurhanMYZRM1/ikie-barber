import { test, expect, type Page } from "@playwright/test";
import { getShopToday, shiftDay, calendarLabel, weekday } from "../../lib/time";
import { fromZonedTime } from "date-fns-tz";

const HAIRCUT = "20000000-0000-4000-8000-000000000001";
// Test-only ID from playwright.config.ts; password is the stand-in's default.
async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("ID", { exact: true }).fill("test-owner");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
}
test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:54329/test/reset");
});
test("public shop is responsive and owner routes need login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choose your time" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Price list" })).toBeVisible();
  await expect(page.getByText("Signature haircut")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /owner|login/i })).toHaveCount(0);
  // The address is only revealed after booking: not on screen, not in the page data.
  expect(await page.content()).not.toContain("Kuala Lumpur, Malaysia");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  for (const route of [
    "/admin",
    "/admin/hours",
    "/admin/history",
    "/admin/settings",
    "/admin/history/2026-10-21",
    "/admin/services",
    "/admin/visits",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/admin\/login$/);
  }
  // A wrong ID or a wrong password gives the same message and no access.
  for (const [id, password] of [
    ["someone", "test-password-only"],
    ["test-owner", "wrong-password"],
  ]) {
    await page.getByLabel("ID", { exact: true }).fill(id);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("That ID or password isn’t right.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login$/);
  }
});
test("owner adds, edits and deletes earnings through mobile sheet", async ({ page }) => {
  // Simulate local HTTP phone testing, where randomUUID is not available.
  await page.addInitScript(() =>
    Object.defineProperty(window.crypto, "randomUUID", { value: undefined }),
  );
  await signIn(page);
  await page.getByRole("button", { name: "Add earnings", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Amount (RM)")).toBeFocused();
  await page.getByLabel("Amount (RM)").fill("35.50");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Edit earnings entry, RM 35.50" })).toBeVisible();
  await page.getByRole("button", { name: "Edit earnings entry, RM 35.50" }).click();
  await page.getByLabel("Amount (RM)").fill("50");
  await page.getByRole("button", { name: "Save entry" }).click();
  await page.getByRole("button", { name: "Edit earnings entry, RM 50.00" }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Delete entry" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete entry" }).click();
  await expect(page.getByText("No earnings logged today. Tap + to add one.")).toBeVisible();
});
test("away mode and hours are saved and reflected publicly", async ({ page }) => {
  await signIn(page);
  await page.getByRole("switch", { name: "Shop is available" }).click();
  await page.getByLabel("Note (optional)", { exact: true }).fill("Taking a short break.");
  await page.getByRole("button", { name: "Set as unavailable" }).click();
  await expect(page.getByRole("switch")).not.toBeChecked();
  await page.goto("/");
  await expect(page.getByText("Not available until further notice")).toBeVisible();
  await expect(page.getByText("Taking a short break.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose your time" })).toHaveCount(0);
  // Away mode explains the pause and offers contact, never a picker that isn't there.
  await expect(page.getByRole("heading", { name: "Booking is paused" })).toBeVisible();
  await expect(page.getByRole("link", { name: "WhatsApp me" })).toHaveAttribute(
    "href",
    "https://wa.me/601157878404",
  );
  await expect(page.getByText("Pick a time above to book.")).toHaveCount(0);
  await page.goto("/admin/hours");
  await page.getByRole("switch").click();
  await expect(page.getByRole("switch")).toBeChecked();
  await page.getByRole("button", { name: /Monday/ }).click();
  await page.getByLabel("From", { exact: true }).fill("10:00");
  await page.getByLabel("To", { exact: true }).fill("09:00");
  await page.getByRole("button", { name: "Save Monday" }).click();
  await expect(page.getByText("Closing time must be after opening time.")).toBeVisible();
  await page.getByLabel("To", { exact: true }).fill("23:00");
  await page.getByRole("button", { name: "Save Monday" }).click();
  await expect(page.getByRole("button", { name: /Monday/ })).toContainText("11:00 PM");
  await page.goto("/");
  await expect(page.getByText("Not available until further notice")).not.toBeVisible();
  const today = getShopToday();
  await page.getByLabel("Visit date", { exact: true }).fill(shiftDay(today, 7 - weekday(today)));
  await expect(page.getByRole("button", { name: "10:00 AM", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Opening hours" })).toHaveCount(0);
});
test("customers book a slot, it grays out, and the owner can cancel it", async ({ page }) => {
  const today = getShopToday();
  const monday = shiftDay(today, 7 - weekday(today));
  await page.goto("/");
  await page.getByLabel("Visit date", { exact: true }).fill(monday);
  await page.getByRole("button", { name: "3:00 PM", exact: true }).click();
  await page.getByLabel("Your name").fill("Ali");
  await page.getByLabel("WhatsApp number").fill("012-345 6789");
  await page.getByLabel("Where").selectOption({ label: "Bangi house call · RM 35.00" });
  await expect(page.getByLabel("Price", { exact: true })).toContainText("RM 35.00");
  await expect(page.getByLabel("Your address")).toHaveAttribute("required", "");
  await page.getByLabel("Your address").fill("No. 1, Jalan Bangi");
  await page.locator("#booking-form").getByRole("button", { name: "Book this time" }).click();
  await expect(page.getByRole("heading", { name: "You’re booked" })).toBeFocused();
  // A house call shows the customer's own address, never the shop's directions.
  await expect(page.getByText("No. 1, Jalan Bangi")).toBeVisible();
  await expect(page.getByText("Kuala Lumpur, Malaysia")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Waze|Google Maps/ })).toHaveCount(0);
  const href = await page.getByRole("link", { name: "Send on WhatsApp" }).getAttribute("href");
  const url = new URL(href!);
  expect(url.pathname).toBe("/601157878404");
  expect(url.searchParams.get("text")).toContain(calendarLabel(monday, "EEEE, d MMMM yyyy"));
  expect(url.searchParams.get("text")).toContain("3:00 PM");

  await page.goto("/");
  await page.getByLabel("Visit date", { exact: true }).fill(monday);
  await expect(page.getByRole("button", { name: "3:00 PM, booked" })).toBeDisabled();

  await signIn(page);
  await expect(page.getByText("Ali · Haircut · Bangi house call")).toBeVisible();
  await expect(page.getByRole("link", { name: "+60123456789" })).toBeVisible();
  // The Bookings page lists it as upcoming; past bookings are read-only.
  await page.getByRole("link", { name: "See all bookings" }).click();
  await expect(page.getByRole("link", { name: "Bookings", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const upcoming = page.getByRole("region", { name: "Upcoming bookings" });
  await expect(upcoming.getByText("Ali · Haircut · Bangi house call")).toBeVisible();
  await expect(upcoming).toContainText("RM 35.00");
  // The house-call address opens in Waze or Google Maps.
  const waze = upcoming.getByRole("link", { name: "Waze directions to Ali" });
  expect(new URL((await waze.getAttribute("href"))!).searchParams.get("q")).toBe(
    "No. 1, Jalan Bangi",
  );
  const google = upcoming.getByRole("link", { name: "Google Maps directions to Ali" });
  expect(new URL((await google.getAttribute("href"))!).searchParams.get("query")).toBe(
    "No. 1, Jalan Bangi",
  );
  await expect(page.getByRole("region", { name: "Past bookings" })).toContainText(
    "No past bookings yet.",
  );
  await page.goto("/admin");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancel booking for Ali" }).click();
  await expect(page.getByText("Booking cancelled.")).toBeVisible();
  await page.goto("/");
  await page.getByLabel("Visit date", { exact: true }).fill(monday);
  await expect(page.getByRole("button", { name: "3:00 PM", exact: true })).toBeEnabled();
});
test("dark mobile and desktop layouts fit; screenshots are reviewable", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: "test-results/visitor-mobile.png", fullPage: true });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: "test-results/visitor-dark.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await signIn(page);
  await page.screenshot({ path: "test-results/owner-mobile-dark.png", fullPage: true });
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/owner-desktop.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByRole("navigation", { name: "Owner navigation" })).toBeVisible();
});

test("midnight clears today and keeps the entry in history", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Add earnings", exact: true }).click();
  await page.getByLabel("Amount (RM)").fill("25");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByRole("button", { name: "Edit earnings entry, RM 25.00" })).toBeVisible();
  const originalDay = getShopToday();
  await page.clock.install();
  await page.clock.setSystemTime(
    fromZonedTime(`${shiftDay(originalDay, 1)}T00:00:01`, "Asia/Kuala_Lumpur"),
  );
  await page.clock.runFor(1100);
  await expect(page.getByText("No earnings logged today. Tap + to add one.")).toBeVisible();
  await page.getByRole("link", { name: "History", exact: true }).click();
  const day = page.getByRole("link", {
    name: new RegExp(calendarLabel(originalDay, "EEE, d MMM yyyy")),
  });
  await expect(day).toContainText("RM 25.00");
  await day.click();
  await expect(page.getByRole("button", { name: "Edit earnings entry, RM 25.00" })).toBeVisible();
});

test("owner removes a break and signs out", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "Your services" })).toHaveCount(0);
  await page.goto("/admin/hours");
  await page.getByRole("button", { name: /Monday/ }).click();
  await page.getByLabel("Include a break").uncheck();
  await page.getByRole("button", { name: "Save Monday" }).click();
  await expect(page.getByRole("button", { name: /Monday/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.goto("/");
  const today = getShopToday();
  await page.getByLabel("Visit date", { exact: true }).fill(shiftDay(today, 7 - weekday(today)));
  await expect(page.getByRole("button", { name: "7:00 PM", exact: true })).toBeVisible();
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("Malay follows the phone language and the BM / EN switch is remembered", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "ms-MY" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pilih masa anda" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ms");
  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.getByRole("heading", { name: "Choose your time" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Choose your time" })).toBeVisible();
  await page.getByRole("button", { name: "BM" }).click();
  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: "Log masuk pemilik" })).toBeVisible();
  await page.getByLabel("ID", { exact: true }).fill("someone");
  await page.getByLabel("Kata laluan", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Log masuk", exact: true }).click();
  await expect(page.getByText("ID atau kata laluan tidak betul.")).toBeVisible();
  await context.close();
});

test("a rejected field keeps what was typed and points the customer to it", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("group", { name: "Available times" })
    .getByRole("button", { disabled: false })
    .first()
    .click();
  await page.getByLabel("Your name").fill("Ali");
  await page.getByLabel("WhatsApp number").fill("12");
  await page.locator("#booking-form").getByRole("button", { name: "Book this time" }).click();
  const phone = page.getByLabel("WhatsApp number");
  await expect(phone).toBeFocused();
  await expect(phone).toHaveAttribute("aria-invalid", "true");
  await expect(phone).toHaveAccessibleDescription(/Enter your WhatsApp number/);
  await expect(page.getByLabel("Your name")).toHaveValue("Ali");
  // A shop visit, once booked, reveals the address with Waze and Google Maps directions.
  await phone.fill("0123456789");
  await page.locator("#booking-form").getByRole("button", { name: "Book this time" }).click();
  const query = "Kuala Lumpur, Malaysia";
  await expect(page.getByText(query)).toBeVisible();
  const waze = new URL((await page.getByRole("link", { name: "Waze" }).getAttribute("href"))!);
  expect(waze.searchParams.get("q")).toBe(query);
  const google = new URL(
    (await page.getByRole("link", { name: "Google Maps" }).getAttribute("href"))!,
  );
  expect(google.searchParams.get("query")).toBe(query);
});

test("owner sidebar controls stay inside the sidebar", async ({ page }) => {
  await signIn(page);
  for (const lang of ["en", "ms"]) {
    await page.context().addCookies([{ name: "lang", value: lang, url: "http://localhost:3100" }]);
    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin");
      const aside = await page.locator("aside").boundingBox();
      for (const control of [
        page.locator("aside a").first(),
        page.getByRole("group", { name: /Language|Bahasa/ }),
      ]) {
        const box = await control.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(aside!.x);
        expect(box!.x + box!.width).toBeLessThanOrEqual(aside!.x + aside!.width);
      }
    }
  }
});

test("a clash marks the slot taken and keeps the customer's details", async ({ page, request }) => {
  await page.goto("/");
  const slot = page
    .getByRole("group", { name: "Available times" })
    .getByRole("button", { disabled: false })
    .first();
  const label = (await slot.textContent())!.trim();
  await slot.click();
  await page.getByLabel("Your name").fill("Ali");
  await page.getByLabel("WhatsApp number").fill("0123456789");
  // Another customer takes the same time while this form is open.
  const day = await page.getByLabel("Visit date", { exact: true }).inputValue();
  const [clock, half] = label.split(" ");
  const [hour, minute] = clock.split(":").map(Number);
  const hh = String((hour % 12) + (half === "PM" ? 12 : 0)).padStart(2, "0");
  const start = fromZonedTime(
    `${day}T${hh}:${String(minute).padStart(2, "0")}:00`,
    "Asia/Kuala_Lumpur",
  );
  await request.post("http://127.0.0.1:54329/rest/v1/bookings", {
    data: {
      slot_start: start.toISOString(),
      name: "Other",
      phone: "60111111111",
      kind: "shop",
      service_id: HAIRCUT,
      total: 8,
    },
  });
  await page.locator("#booking-form").getByRole("button", { name: "Book this time" }).click();
  await expect(page.getByText("That time was just booked. Choose another.")).toBeVisible();
  await expect(page.getByRole("button", { name: `${label}, booked` })).toBeDisabled();
  await expect(page.getByLabel("Your name")).toHaveValue("Ali");
});

test("owner adds a service and changes a price; booked prices stay as agreed", async ({
  page,
  request,
}) => {
  const today = getShopToday();
  const monday = shiftDay(today, 7 - weekday(today));
  await request.post("http://127.0.0.1:54329/rest/v1/bookings", {
    data: {
      slot_start: fromZonedTime(`${monday}T16:00:00`, "Asia/Kuala_Lumpur").toISOString(),
      name: "Early",
      phone: "60111111111",
      kind: "shop",
      service_id: HAIRCUT,
      total: 8,
    },
  });
  await signIn(page);
  await page.goto("/admin/settings");
  await page.getByRole("link", { name: /Services & prices/ }).click();
  await page.getByRole("button", { name: /^Haircut/ }).click();
  await page.getByLabel("At the shop").fill("9");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Haircut.*RM 9\.00/ })).toBeVisible();
  await page.getByRole("button", { name: "Add a service" }).click();
  await page.getByLabel("Service name").fill("Beard trim");
  await page.getByLabel("Length (minutes)").fill("20");
  await page.getByLabel("At the shop").last().fill("5");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Beard trim/ })).toBeVisible();

  await page.goto("/");
  const prices = page.getByRole("region", { name: "Price list" });
  await expect(prices).toContainText("Beard trim");
  await expect(prices).toContainText("RM 9.00");
  await page.getByRole("button", { name: /Beard trim/ }).click();
  await page.getByLabel("Visit date", { exact: true }).fill(monday);
  await page.getByRole("button", { name: "5:00 PM", exact: true }).click();
  await expect(page.getByLabel("Price", { exact: true })).toContainText("RM 5.00");

  await page.goto("/admin/bookings");
  await expect(page.getByRole("region", { name: "Upcoming bookings" })).toContainText(
    "Early · Haircut · At the shop · RM 8.00",
  );
});

test("saved coverage and contact changes reach the public page and metadata", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/settings");
  await page.getByLabel("Shop name", { exact: true }).fill("Campus Cuts");
  await page.getByLabel("Instagram link (optional)").fill("https://www.instagram.com/campuscuts/");
  await page.getByRole("button", { name: "Save shop details" }).click();
  await expect(page.getByText("Shop details saved.")).toBeVisible();
  await page.goto("/admin/services");
  await page.getByRole("button", { name: "Bangi", exact: true }).click();
  await page.getByLabel("Area name").fill("Kajang");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Kajang", exact: true })).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByText("Haircuts at the shop, or I come to you in Putrajaya, Cyberjaya, and Kajang."),
  ).toBeVisible();
  await expect(page).toHaveTitle(/Campus Cuts/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Kajang/);
  await expect(page.locator('meta[name="description"]')).not.toHaveAttribute("content", /Bangi/);
  await expect(page.getByRole("link", { name: "Instagram", exact: true })).toHaveAttribute(
    "href",
    "https://www.instagram.com/campuscuts/",
  );
  await page.getByRole("button", { name: "BM", exact: true }).click();
  await expect(
    page.getByText(
      "Gunting rambut di kedai, atau saya datang ke rumah anda di Putrajaya, Cyberjaya dan Kajang.",
    ),
  ).toBeVisible();
});

test("refresh recovers a saved booking after its response is lost", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("group", { name: "Available times" })
    .getByRole("button", { disabled: false })
    .first()
    .click();
  await page.getByLabel("Your name").fill("Lost response");
  await page.getByLabel("WhatsApp number").fill("0123456789");
  let intercepted = false;
  await page.route("**/*", async (route) => {
    if (
      !intercepted &&
      route.request().method() === "POST" &&
      route.request().headers()["next-action"]
    ) {
      intercepted = true;
      await route.fetch(); // Let the database save before discarding the response.
      await route.abort("failed");
    } else await route.continue();
  });
  await page.locator("#booking-form").getByRole("button", { name: "Book this time" }).click();
  await expect(
    page.getByText("Couldn’t send your booking. Check your connection and tap Book again."),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "You’re booked" })).toBeVisible();
  await signIn(page);
  await page.goto("/admin/bookings");
  await expect(page.getByText(/Lost response · Haircut/)).toHaveCount(1);
});

test("uni visits have no location fields and require direct WhatsApp confirmation", async ({
  page,
  browser,
  request,
}) => {
  const tomorrow = shiftDay(getShopToday(), 1);
  await signIn(page);
  await page.goto("/admin/bookings");
  await page.getByRole("link", { name: /Uni visits/ }).click();
  await page.getByRole("button", { name: "New visit" }).click();
  await page.getByLabel("Starts").fill("15:00");
  await page.getByLabel("Ends").fill("17:00");
  await expect(page.getByLabel("General meeting area")).toHaveCount(0);
  await expect(page.getByLabel(/Exact meeting point/)).toHaveCount(0);
  await expect(page.getByLabel(/Map link/)).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Haircut", exact: true }).check();
  await page.getByLabel("Visit price for Haircut").fill("6");
  await page.getByRole("button", { name: "Save visit" }).click();
  const visit = page.getByRole("article");
  await expect(visit).toContainText("Haircut RM 6.00");

  // Duplicate scheduling and prices without any location fields.
  await visit.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.getByLabel("General meeting area")).toHaveCount(0);
  await page.getByRole("button", { name: "Save visit" }).click();
  await expect(page.getByRole("article")).toHaveCount(2);

  // Existing records may still have locations: none may reappear in the app.
  const auth = await request.post("http://127.0.0.1:54329/auth/v1/token", {
    data: { email: "owner@example.test", password: "test-password-only" },
  });
  const { access_token } = await auth.json();
  const legacy = await request.patch("http://127.0.0.1:54329/rest/v1/university_visits", {
    headers: { Authorization: `Bearer ${access_token}` },
    data: {
      area_label: "Old campus area",
      meeting_point: "Old meeting point",
      map_url: "https://maps.app/old",
    },
  });
  expect(legacy.ok()).toBe(true);
  await page.reload();
  await expect(page.getByText(/Old campus area|Old meeting point/)).toHaveCount(0);

  // The visit and its travel/setup time close those shop times.
  await page.goto("/");
  await page.getByLabel("Visit date", { exact: true }).fill(tomorrow);
  await expect(page.getByRole("button", { name: "3:00 PM, booked" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "5:00 PM, booked" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "5:30 PM", exact: true })).toBeEnabled();
  await page.getByRole("link", { name: "See uni visits" }).click();

  await expect(page.getByRole("heading", { name: "For uni students" })).toBeVisible();
  await expect(
    page.getByText(
      "I come to Universiti Islam Selangor (UIS) on set days. Pick a visit, a haircut and a time; we confirm the exact spot on WhatsApp.",
    ),
  ).toHaveCount(0);
  expect(await page.content()).not.toContain("Old campus area");
  expect(await page.content()).not.toContain("Old meeting point");
  await page.getByRole("group", { name: "Uni visits" }).getByRole("button").first().click();
  await expect(page.getByRole("group", { name: "Haircuts" })).toContainText("RM 6.00");
  await page.getByRole("button", { name: "3:00 PM", exact: true }).click();
  await page.getByLabel("Your name").fill("Ali");
  await page.getByLabel("WhatsApp number").fill("0123456789");
  await page.locator("#booking-form").getByRole("button", { name: "Book this time" }).click();
  await expect(page.getByRole("heading", { name: "You’re booked" })).toBeFocused();
  await expect(
    page.getByText(
      "Your booking is saved. Please confirm the haircut location with the owner via WhatsApp before your appointment.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Proposed meeting point")).toHaveCount(0);
  await expect(page.getByText("Where", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Google Maps" })).toHaveCount(0);
  expect(await page.content()).not.toContain("Old meeting point");
  const confirm = new URL(
    (await page.getByRole("link", { name: "Confirm location on WhatsApp" }).getAttribute("href"))!,
  );
  expect(confirm.pathname).toBe("/601157878404");
  const text = confirm.searchParams.get("text")!;
  for (const part of [
    "Ali",
    "Haircut",
    calendarLabel(tomorrow, "EEEE, d MMMM yyyy"),
    "3:00 PM",
    "Please confirm the haircut location.",
  ])
    expect(text).toContain(part);
  expect(text).not.toContain("Old meeting point");
  expect(text).not.toContain("Proposed meeting point");
  await page.screenshot({ path: "test-results/uni-booked-mobile.png", fullPage: true });

  // In Malay, the same step with the Malay wording.
  const malay = await browser.newContext({
    locale: "ms-MY",
    viewport: { width: 375, height: 812 },
  });
  const student = await malay.newPage();
  await student.goto("/uni");
  await student
    .getByRole("group", { name: "Lawatan universiti" })
    .getByRole("button")
    .first()
    .click();
  await student.getByRole("button", { name: "3:30 PM", exact: true }).click();
  await student.getByLabel("Nama anda").fill("Siti");
  await student.getByLabel("Nombor WhatsApp").fill("0129876543");
  await student.locator("#booking-form").getByRole("button", { name: "Tempah masa ini" }).click();
  await expect(
    student.getByText(
      "Tempahan anda telah disimpan. Sila sahkan lokasi potong rambut dengan pemilik melalui WhatsApp sebelum waktu temujanji anda.",
    ),
  ).toBeVisible();
  const sahkan = student.getByRole("link", { name: "Sahkan lokasi melalui WhatsApp" });
  expect(new URL((await sahkan.getAttribute("href"))!).searchParams.get("text")).toContain(
    "Sila sahkan lokasi potong rambut.",
  );
  await expect(student.getByText("Cadangan tempat berjumpa")).toHaveCount(0);
  await expect(student.getByText("Di mana", { exact: true })).toHaveCount(0);
  await malay.close();

  // Existing locations stay absent on the owner's edit form and booking lists.
  await page.goto("/admin/visits");
  const first = page.getByRole("article").first();
  await expect(first.getByRole("button", { name: "Cancel visit" })).toBeDisabled();
  await expect(page.getByText(/Old campus area|Old meeting point/)).toHaveCount(0);
  await first.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("General meeting area")).toHaveCount(0);
  await expect(page.getByLabel(/Exact meeting point/)).toHaveCount(0);
  await expect(page.getByLabel(/Map link/)).toHaveCount(0);
  await page.getByRole("button", { name: "Save visit" }).click();
  // Pausing stops new bookings and keeps the two made.
  await first.getByRole("button", { name: "Pause bookings" }).click();
  await expect(first).toContainText("Paused");
  await expect(first.getByText(/Ali · Haircut · Uni visit/)).toBeVisible();
  await page.screenshot({ path: "test-results/owner-visits-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/owner-visits-desktop.png", fullPage: true });
});
