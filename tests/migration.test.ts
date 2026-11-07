import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Upgrading a live shop: earlier migrations, the old seed and real bookings already exist
// when the services migration runs. Nothing may be lost, and no price may be invented.
const db = new PGlite();
const names = readdirSync("supabase/migrations").sort();
const latest = names.pop()!;
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
  for (const name of names) await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  await db.exec(`${readFileSync("supabase/seed.sql", "utf8")}
    insert into public.services (id, name, price, duration_minutes, sort_order) values
    ('10000000-0000-4000-8000-000000000001', 'Signature haircut', 35, 30, 0),
    ('10000000-0000-4000-8000-000000000002', 'Haircut & beard', 50, 45, 1),
    ('10000000-0000-4000-8000-000000000003', 'Beard trim', 20, 20, 2);
    alter table public.bookings disable trigger validate_booking;
    insert into public.bookings (slot_start, name, phone, area, address) values
    ('2026-10-20 15:00+08', 'Past', '60123456789', 'Shop', null),
    ('2026-12-01 16:30+08', 'Later', '60123456789', 'Bangi', 'No. 1, Jalan Bangi');
    alter table public.bookings enable trigger validate_booking;
    insert into public.earnings (amount) values (35);`);
  await db.exec(readFileSync(`supabase/migrations/${latest}`, "utf8"));
}, 30000);
afterAll(async () => {
  await db.close();
});

describe("upgrading an existing shop", () => {
  it("keeps every booking as it was, with no invented price", async () => {
    const rows = await db.query(`select b.name, b.kind, b.area, a.name as area_row, b.address,
      b.slot_end - b.slot_start as length, b.price, b.total, b.service_name
      from public.bookings b left join public.house_call_areas a on a.id = b.area_id order by b.slot_start`);
    expect(rows.rows).toEqual([
      expect.objectContaining({ name: "Past", kind: "shop", area: null, length: "00:30:00" }),
      expect.objectContaining({
        name: "Later",
        kind: "house_call",
        area: "Bangi",
        area_row: "Bangi",
        address: "No. 1, Jalan Bangi",
        price: null,
        total: null,
        service_name: null,
      }),
    ]);
  });
  it("replaces the never-used sample services with the real price list", async () => {
    const services = await db.query(
      "select name, shop_price::text, area_prices from public.services where is_active order by sort_order",
    );
    expect(services.rows.map((row) => (row as { name: string }).name)).toEqual([
      "Haircut",
      "Adult haircut",
    ]);
    expect(services.rows[0]).toMatchObject({ shop_price: "8.00" });
    expect(
      (await db.query("select count(*)::int as count from public.services where not is_active"))
        .rows,
    ).toEqual([{ count: 3 }]);
    expect(Object.values((services.rows[1] as { area_prices: object }).area_prices)).toEqual([
      20, 25, 35,
    ]);
  });
  it("leaves earnings alone", async () => {
    expect((await db.query("select amount::text from public.earnings")).rows).toEqual([
      { amount: "35.00" },
    ]);
  });
});
