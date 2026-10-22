import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// PGlite runs real Postgres in-process. Only Supabase's auth.uid() is stubbed;
// policies, constraints, functions, triggers, and permission checks run as SQL.
const db = new PGlite();
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const stranger = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${owner}'), ('${stranger}');
    -- Like hosted Supabase: new public tables and functions are granted to API roles.
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;`);
  for (const name of readdirSync("supabase/migrations").sort()) {
    await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  }
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(`insert into private.shop_owner(user_id) values ('${owner}');
    insert into public.earnings(amount) values (35);
    insert into public.services(name, price, duration_minutes, is_active) values ('Hidden', 10, 15, false);`);
}, 30000);
afterAll(async () => {
  await db.close();
});

// Use transactions so each simulated request has isolated role/JWT settings.
async function asRole(role: "anon" | "authenticated", id: string, sql: string) {
  return db.transaction(async (tx) => {
    await tx.exec(
      `set local role ${role}; select set_config('request.jwt.claim.sub', '${id}', true);`,
    );
    return tx.query(sql);
  });
}
describe("database security", () => {
  it("anon can read public details but zero earnings", async () => {
    expect(
      (await asRole("anon", "", "select name, whatsapp_number from public.shop_settings")).rows,
    ).toHaveLength(1);
    // The address and map link are only handed out after a booking.
    for (const column of ["address", "maps_url", "*"])
      await expect(
        asRole("anon", "", `select ${column} from public.shop_settings`),
      ).rejects.toThrow(/permission denied/);
    expect(
      (await asRole("authenticated", owner, "select address from public.shop_settings")).rows,
    ).toEqual([{ address: "Kuala Lumpur, Malaysia" }]);
    expect((await asRole("anon", "", "select * from public.weekly_hours")).rows).toHaveLength(7);
    expect((await asRole("anon", "", "select * from public.services")).rows).toHaveLength(3);
    expect((await asRole("anon", "", "select * from public.earnings")).rows).toHaveLength(0);
  });
  it("a different authenticated user still cannot read earnings or edit the shop", async () => {
    expect(
      (await asRole("authenticated", stranger, "select * from public.earnings")).rows,
    ).toHaveLength(0);
    expect(
      (
        await asRole(
          "authenticated",
          stranger,
          "update public.shop_settings set name = 'Hacked' returning *",
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      asRole("authenticated", stranger, "insert into public.earnings(amount) values (20)"),
    ).rejects.toThrow();
  });
  it("anonymous requests cannot insert earnings or call the totals function", async () => {
    await expect(
      asRole("anon", "", "insert into public.earnings(amount) values (20)"),
    ).rejects.toThrow();
    await expect(
      asRole("anon", "", "select * from public.daily_earnings_totals()"),
    ).rejects.toThrow();
  });
  it("owner can read inactive services and add, edit, and delete earnings", async () => {
    expect(
      (await asRole("authenticated", owner, "select * from public.services")).rows,
    ).toHaveLength(4);
    const result = await asRole(
      "authenticated",
      owner,
      "insert into public.earnings(amount, business_date) values (50, '1999-01-01') returning id, business_date::text",
    );
    const row = result.rows[0] as { id: string; business_date: string };
    const expected = await db.query<{ today: string }>(
      "select (now() at time zone 'Asia/Kuala_Lumpur')::date::text as today",
    );
    expect(row.business_date).toBe(expected.rows[0].today);
    const updated = await asRole(
      "authenticated",
      owner,
      `update public.earnings set amount=60, business_date='1990-01-01' where id='${row.id}' returning business_date::text`,
    );
    expect(updated.rows[0]).toEqual({ business_date: row.business_date });
    expect(
      (
        await asRole(
          "authenticated",
          owner,
          `delete from public.earnings where id='${row.id}' returning *`,
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("database rejects invalid schedules, timezones and amounts", async () => {
    await expect(
      asRole(
        "authenticated",
        owner,
        "update public.weekly_hours set close_time='09:00' where day_of_week=0",
      ),
    ).rejects.toThrow();
    await expect(
      asRole(
        "authenticated",
        owner,
        "update public.weekly_hours set open_time='10:07' where day_of_week=0",
      ),
    ).rejects.toThrow();
    await expect(
      asRole("authenticated", owner, "update public.shop_settings set timezone='Not/A_Zone'"),
    ).rejects.toThrow();
    await expect(
      asRole("authenticated", owner, "insert into public.earnings(amount) values (-1)"),
    ).rejects.toThrow();
    await expect(
      asRole("authenticated", owner, "insert into public.earnings(amount) values ('NaN')"),
    ).rejects.toThrow();
    await expect(
      asRole(
        "authenticated",
        owner,
        "update public.weekly_hours set open_time='10:00:00.1' where day_of_week=0",
      ),
    ).rejects.toThrow();
  });
  it("a non-owner cannot appoint themselves owner", async () => {
    await expect(
      asRole("authenticated", stranger, `update private.shop_owner set user_id='${stranger}'`),
    ).rejects.toThrow();
    expect(
      (await asRole("authenticated", stranger, "select * from public.daily_earnings_totals()"))
        .rows,
    ).toHaveLength(0);
  });
  it("daily aggregation includes more than 1,000 entries", async () => {
    await asRole(
      "authenticated",
      owner,
      "insert into public.earnings(amount) select 1 from generate_series(1,1100)",
    );
    const result = await asRole(
      "authenticated",
      owner,
      "select entry_count::integer, total::text from public.daily_earnings_totals()",
    );
    expect(result.rows).toEqual([{ entry_count: 1101, total: "1135.00" }]);
  });
});

// Tomorrow at a whole hour is always a valid, future half-hour slot.
const slot = (hours: number) => `date_trunc('hour', now()) + interval '1 day ${hours} hours'`;
const book = (when: string, area = "'Shop'", address = "null") =>
  `insert into public.bookings(slot_start, name, phone, area, address)
   values (${when}, 'Ali', '60123456789', ${area}, ${address})`;
describe("bookings", () => {
  it("visitors can book and see booked times, but never who booked", async () => {
    await asRole("anon", "", book(slot(0)));
    expect((await asRole("anon", "", "select slot_start from public.bookings")).rows).toHaveLength(
      1,
    );
    await expect(asRole("anon", "", "select name from public.bookings")).rejects.toThrow(
      /permission denied/,
    );
    await expect(asRole("anon", "", "select * from public.bookings")).rejects.toThrow(
      /permission denied/,
    );
    expect(
      (await asRole("authenticated", stranger, "select * from public.bookings")).rows,
    ).toHaveLength(0);
    expect(
      (await asRole("authenticated", owner, "select name, phone from public.bookings")).rows,
    ).toEqual([{ name: "Ali", phone: "60123456789" }]);
  });
  it("gives the shop address only to the holder of a shop-visit booking", async () => {
    const shopVisit = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const houseCall = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    await asRole(
      "anon",
      "",
      `insert into public.bookings(id, slot_start, name, phone, area) values
       ('${shopVisit}', ${slot(5)}, 'Ali', '60123456789', 'Shop')`,
    );
    await asRole(
      "anon",
      "",
      `insert into public.bookings(id, slot_start, name, phone, area, address) values
       ('${houseCall}', ${slot(6)}, 'Ali', '60123456789', 'Bangi', 'No. 1')`,
    );
    const directions = (id: string) =>
      asRole("anon", "", `select * from public.booking_directions('${id}')`);
    expect((await directions(shopVisit)).rows).toEqual([
      { address: "Kuala Lumpur, Malaysia", maps_url: "" },
    ]);
    expect((await directions(houseCall)).rows).toHaveLength(0);
    expect((await directions("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")).rows).toHaveLength(0);
  });
  it("rejects a second booking for the same slot", async () => {
    await expect(
      asRole("anon", "", book(slot(1)).replace("'Ali'", "'Abu'")),
    ).resolves.toBeDefined();
    await expect(asRole("anon", "", book(slot(1)))).rejects.toMatchObject({ code: "23505" });
  });
  it("rejects past, misaligned and address-less house-call bookings", async () => {
    await expect(asRole("anon", "", book("now() - interval '1 day'"))).rejects.toThrow(/half-hour/);
    await expect(asRole("anon", "", book(`${slot(2)} + interval '10 minutes'`))).rejects.toThrow(
      /half-hour/,
    );
    // Fractions of a second must not round onto the half hour.
    await expect(asRole("anon", "", book(`${slot(2)} - interval '0.4 seconds'`))).rejects.toThrow(
      /half-hour/,
    );
    await expect(asRole("anon", "", book(slot(3), "'Bangi'"))).rejects.toThrow(
      /house_call_address/,
    );
  });
  it("a retry with the same id reports the primary key, not the taken slot", async () => {
    const retry = `insert into public.bookings(id, slot_start, name, phone, area)
      values ('22222222-2222-4222-8222-222222222222', ${slot(4)}, 'Ali', '60123456789', 'Shop')`;
    await asRole("anon", "", retry);
    await expect(asRole("anon", "", retry)).rejects.toThrow(/bookings_pkey/);
    await asRole(
      "authenticated",
      owner,
      `delete from public.bookings where id = '22222222-2222-4222-8222-222222222222'`,
    );
  });
  it("only the owner can cancel", async () => {
    await expect(asRole("anon", "", "delete from public.bookings")).rejects.toThrow();
    expect(
      (await asRole("authenticated", stranger, "delete from public.bookings returning id")).rows,
    ).toHaveLength(0);
    expect(
      (await asRole("authenticated", owner, "delete from public.bookings returning id")).rows,
    ).toHaveLength(4);
  });
  it("seeded hours close at midnight", async () => {
    const rows = (await db.query("select close_time::text from public.weekly_hours")).rows;
    expect(rows).toHaveLength(7);
    expect(rows.every((row) => (row as { close_time: string }).close_time === "00:00:00")).toBe(
      true,
    );
  });
});
