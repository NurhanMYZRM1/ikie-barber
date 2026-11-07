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
    insert into public.services(name, shop_price, duration_minutes, is_active) values ('Hidden', 10, 15, false);`);
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
    expect((await asRole("anon", "", "select * from public.services")).rows).toHaveLength(2);
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
    ).toHaveLength(3);
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

// Seeded hours: every day 3 PM to midnight, break 6:30–8 PM, in Kuala Lumpur.
const HAIRCUT = "20000000-0000-4000-8000-000000000001";
const ADULT = "20000000-0000-4000-8000-000000000002";
const BANGI = "30000000-0000-4000-8000-000000000003";
const LONG = "40000000-0000-4000-8000-000000000001";
const VISIT = "50000000-0000-4000-8000-000000000001";
// A shop-local clock time `days` from today, as a timestamptz SQL expression.
const at = (clock: string, days = 1) =>
  `(((now() at time zone 'Asia/Kuala_Lumpur')::date + ${days} + time '${clock}') at time zone 'Asia/Kuala_Lumpur')`;
type Booking = {
  id?: string;
  kind?: string;
  service?: string;
  area?: string;
  visit?: string;
  address?: string;
  total?: number | null;
  name?: string;
};
const q = (value?: string | number | null) =>
  value === undefined || value === null ? "null" : typeof value === "number" ? value : `'${value}'`;
const book = (when: string, b: Booking = {}) =>
  `insert into public.bookings(id, slot_start, kind, service_id, area_id, visit_id, name, phone, address, total)
   values (${b.id ? q(b.id) : "gen_random_uuid()"}, ${when}, ${q(b.kind ?? "shop")}, ${q(b.service ?? HAIRCUT)},
   ${q(b.area)}, ${q(b.visit)}, ${q(b.name ?? "Ali")}, '60123456789', ${q(b.address)}, ${q(b.total === undefined ? 8 : b.total)})`;
const asOwner = (sql: string) => asRole("authenticated", owner, sql);
const visit = (id: string, from: string, start: string, end: string, until: string, days = 2) =>
  `insert into public.university_visits(id, reserved_from, starts_at, ends_at, reserved_until, area_label, meeting_point, services)
   values ('${id}', ${at(from, days)}, ${at(start, days)}, ${at(end, days)}, ${at(until, days)}, 'UIS', 'Dewan A',
   '{"${HAIRCUT}": 5, "${LONG}": null}')`;

describe("bookings", () => {
  beforeAll(async () => {
    await asOwner(`insert into public.services(id, name, shop_price, university_price, duration_minutes)
      values ('${LONG}', 'Long cut', 15, 12, 60)`);
  });
  it("visitors can book and see booked times, but never who booked", async () => {
    await asRole("anon", "", book(at("16:00")));
    expect(
      (await asRole("anon", "", "select slot_start, slot_end from public.bookings")).rows,
    ).toHaveLength(1);
    for (const column of ["name", "*", "total", "service_name"])
      await expect(asRole("anon", "", `select ${column} from public.bookings`)).rejects.toThrow(
        /permission denied/,
      );
    expect(
      (await asRole("authenticated", stranger, "select * from public.bookings")).rows,
    ).toHaveLength(0);
    expect(
      (
        await asOwner(
          "select name, phone, kind, service_name, price::text, total::text, charges, slot_end - slot_start as length from public.bookings",
        )
      ).rows,
    ).toEqual([
      {
        name: "Ali",
        phone: "60123456789",
        kind: "shop",
        service_name: "Haircut",
        price: "8.00",
        total: "8.00",
        charges: [],
        length: "00:30:00",
      },
    ]);
  });
  it("the database sets the length and price; later edits never change a booking", async () => {
    // A client may not write its own price, length or snapshot.
    await expect(
      asRole(
        "anon",
        "",
        `insert into public.bookings(slot_start, kind, service_id, name, phone, total, price)
         values (${at("17:00")}, 'shop', '${HAIRCUT}', 'Ali', '60123456789', 1, 1)`,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(asRole("anon", "", book(at("17:00"), { total: 1 }))).rejects.toThrow(
      /Price changed/,
    );
    await expect(asRole("anon", "", book(at("17:00"), { total: null }))).rejects.toThrow(
      /Price changed/,
    );
    await asRole("anon", "", book(at("17:00"), { service: LONG, total: 15, name: "Abu" }));
    await asOwner(
      `update public.services set shop_price = 20, duration_minutes = 30, name = 'Renamed' where id = '${LONG}'`,
    );
    expect(
      (
        await asOwner(
          "select service_name, price::text, slot_end - slot_start as length from public.bookings where name = 'Abu'",
        )
      ).rows,
    ).toEqual([{ service_name: "Long cut", price: "15.00", length: "01:00:00" }]);
    await asOwner(
      `update public.services set shop_price = 15, duration_minutes = 60, name = 'Long cut' where id = '${LONG}'`,
    );
  });
  it("rejects overlapping appointments of any length, but not back-to-back ones", async () => {
    await asRole("anon", "", book(at("21:00"), { service: LONG, total: 15 }));
    await expect(asRole("anon", "", book(at("21:30")))).rejects.toMatchObject({ code: "23P01" });
    await expect(
      asRole("anon", "", book(at("20:30"), { service: LONG, total: 15 })),
    ).rejects.toMatchObject({
      code: "23P01",
    });
    await expect(asRole("anon", "", book(at("22:00")))).resolves.toBeDefined();
  });
  it("rejects closed, past, misaligned, too-far and too-long times", async () => {
    for (const when of [
      at("19:00"), // the break
      at("10:00"), // before opening
      at("16:10"), // not on the half hour
      `${at("16:00")} - interval '0.4 seconds'`, // must not round onto the half hour
      "now() - interval '1 day'",
      at("16:00", 40), // more than 31 days ahead
    ])
      await expect(asRole("anon", "", book(when))).rejects.toThrow(/available time/);
    // An hour from 6 PM runs into the break; an hour from 11:30 PM runs past midnight.
    for (const when of [at("18:00"), at("23:30")])
      await expect(asRole("anon", "", book(when, { service: LONG, total: 15 }))).rejects.toThrow(
        /available time/,
      );
    // Hidden services cannot be booked.
    await expect(
      asRole(
        "anon",
        "",
        book(at("15:00"), {
          service: (
            await db.query<{ id: string }>("select id from public.services where name = 'Hidden'")
          ).rows[0].id,
          total: 10,
        }),
      ),
    ).rejects.toThrow(/available service/);
  });
  it("prices house calls by area, and needs an address", async () => {
    await expect(
      asRole("anon", "", book(at("15:00"), { kind: "house_call", area: BANGI, total: 35 })),
    ).rejects.toThrow(/house_call_address/);
    await expect(
      asRole("anon", "", book(at("15:00"), { kind: "house_call", area: BANGI, address: "No. 1" })),
    ).rejects.toThrow(/Price changed/);
    await asRole(
      "anon",
      "",
      book(at("15:00"), {
        kind: "house_call",
        area: BANGI,
        address: "No. 1",
        total: 35,
        name: "Siti",
      }),
    );
    expect(
      (await asOwner("select area, address, price::text from public.bookings where name = 'Siti'"))
        .rows,
    ).toEqual([{ area: "Bangi", address: "No. 1", price: "35.00" }]);
    // Long cut has no house-call prices, so it isn't offered there.
    await expect(
      asRole(
        "anon",
        "",
        book(at("15:30", 3), { kind: "house_call", area: BANGI, address: "No. 1", service: LONG }),
      ),
    ).rejects.toThrow(/available service/);
  });
  it("adds rule-based extra charges and records them", async () => {
    await asOwner(
      "update public.extra_charges set notice_hours = 72 where label = 'Last minute / urgent'",
    );
    await expect(asRole("anon", "", book(at("15:30", 2)))).rejects.toThrow(/Price changed/);
    await asRole("anon", "", book(at("15:30", 2), { total: 18, name: "Urgent" }));
    await asOwner("update public.extra_charges set notice_hours = null, starts_from = null");
    await asOwner("update public.extra_charges set starts_from = '23:00' where label like 'Late%'");
    await asRole("anon", "", book(at("23:00"), { total: 13, name: "Late" }));
    await asOwner("update public.extra_charges set starts_from = null");
    expect(
      (
        await asOwner(
          "select name, total::text, charges from public.bookings where name in ('Urgent', 'Late') order by name",
        )
      ).rows,
    ).toEqual([
      { name: "Late", total: "13.00", charges: [{ label: "Late night (after 12 am)", amount: 5 }] },
      { name: "Urgent", total: "18.00", charges: [{ label: "Last minute / urgent", amount: 10 }] },
    ]);
  });
  it("away mode pauses booking", async () => {
    await asOwner("update public.shop_settings set is_available = false");
    await expect(asRole("anon", "", book(at("16:30", 3)))).rejects.toThrow(/available time/);
    await asOwner("update public.shop_settings set is_available = true");
  });
  it("gives the shop address only to the holder of a shop-visit booking", async () => {
    const shopVisit = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const houseCall = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    await asRole("anon", "", book(at("16:00", 4), { id: shopVisit }));
    await asRole(
      "anon",
      "",
      book(at("17:00", 4), {
        id: houseCall,
        kind: "house_call",
        area: BANGI,
        address: "No. 1",
        total: 35,
      }),
    );
    const directions = (id: string) =>
      asRole("anon", "", `select * from public.booking_directions('${id}')`);
    expect((await directions(shopVisit)).rows).toEqual([
      { address: "Kuala Lumpur, Malaysia", maps_url: "" },
    ]);
    await asOwner(
      "update public.shop_settings set address = 'New shop address', maps_url = 'https://maps.google.com/new'",
    );
    expect((await directions(shopVisit)).rows).toEqual([
      { address: "Kuala Lumpur, Malaysia", maps_url: "" },
    ]);
    await asOwner(
      "update public.shop_settings set address = 'Kuala Lumpur, Malaysia', maps_url = ''",
    );
    expect((await directions(houseCall)).rows).toHaveLength(0);
    expect((await directions("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")).rows).toHaveLength(0);
  });
  it("a retry with the same id reports the duplicate id, not a taken time", async () => {
    const retry = book(at("16:00", 5), { id: "22222222-2222-4222-8222-222222222222" });
    await asRole("anon", "", retry);
    await expect(asRole("anon", "", retry)).rejects.toMatchObject({ code: "23505" });
  });
  it("blocks schedule edits that would invalidate an existing full appointment", async () => {
    const day = `extract(isodow from (now() at time zone 'Asia/Kuala_Lumpur')::date + 1)::int - 1`;
    for (const change of [
      "is_open = false",
      "open_time = '16:30'",
      "close_time = '21:30'",
      "break_start = '17:30', break_end = '20:00'",
    ])
      await expect(
        asOwner(`update public.weekly_hours set ${change} where day_of_week = ${day}`),
      ).rejects.toThrow(/Resolve affected bookings/);
    await expect(
      asOwner(`update public.weekly_hours set open_time = '14:00' where day_of_week = ${day}`),
    ).resolves.toBeDefined();
    await asOwner(`update public.weekly_hours set open_time = '15:00' where day_of_week = ${day}`);
    await expect(asOwner("delete from public.weekly_hours where day_of_week = 0")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      asOwner("update public.shop_settings set timezone = 'Europe/London'"),
    ).rejects.toThrow(/Resolve upcoming bookings/);
  });
});

describe("uni visits", () => {
  // Day +2: a 3–5 PM visit with 30 minutes of travel/setup either side (2:30–5:30 PM).
  it("only the owner manages visits, and visitors never see the exact meeting point", async () => {
    await expect(
      asRole("anon", "", visit(VISIT, "14:30", "15:00", "17:00", "17:30")),
    ).rejects.toThrow();
    await expect(
      asRole("authenticated", stranger, visit(VISIT, "14:30", "15:00", "17:00", "17:30")),
    ).rejects.toThrow();
    // The reserved window clashes with the 3:30 PM booking made above, which is listed first.
    await expect(asOwner(visit(VISIT, "14:30", "15:00", "17:00", "17:30"))).rejects.toThrow(
      /clashes/,
    );
    await asOwner("delete from public.bookings where name = 'Urgent'");
    await asOwner(visit(VISIT, "14:30", "15:00", "17:00", "17:30"));
    expect(
      (await asRole("anon", "", "select area_label, services from public.university_visits")).rows,
    ).toEqual([{ area_label: "UIS", services: { [HAIRCUT]: 5, [LONG]: null } }]);
    for (const column of ["meeting_point", "map_url", "*"])
      await expect(
        asRole("anon", "", `select ${column} from public.university_visits`),
      ).rejects.toThrow(/permission denied/);
    expect(
      (await asRole("authenticated", stranger, "select * from public.university_visits")).rows,
    ).toHaveLength(0);
  });
  it("visits and their buffers keep other bookings and visits out", async () => {
    // Shop bookings: blocked through the after-buffer, fine once it ends.
    await expect(asRole("anon", "", book(at("17:00", 2)))).rejects.toThrow(/available time/);
    await asRole("anon", "", book(at("17:30", 2)));
    // A second visit overlapping the first one's buffer.
    await expect(
      asOwner(visit("50000000-0000-4000-8000-000000000002", "13:00", "13:30", "14:30", "15:00")),
    ).rejects.toMatchObject({ code: "23P01" });
  });
  it("uni bookings fit inside the visit, at the visit's prices", async () => {
    const uni = (when: string, b: Booking = {}) =>
      book(when, { kind: "university", visit: VISIT, ...b });
    // Inside the buffer, or running past the visit's end.
    await expect(asRole("anon", "", uni(at("14:30", 2), { total: 5 }))).rejects.toThrow(
      /available time/,
    );
    await expect(
      asRole("anon", "", uni(at("16:30", 2), { service: LONG, total: 12 })),
    ).rejects.toThrow(/available time/);
    // Not offered at this visit.
    await expect(
      asRole("anon", "", uni(at("15:00", 2), { service: ADULT, total: 10 })),
    ).rejects.toThrow(/available service/);
    // The visit price (5) beats the service's own; a blank visit price uses the uni price (12).
    await expect(asRole("anon", "", uni(at("15:00", 2), { total: 8 }))).rejects.toThrow(
      /Price changed/,
    );
    await asRole(
      "anon",
      "",
      uni(at("15:00", 2), {
        total: 5,
        id: "33333333-3333-4333-8333-333333333333",
        name: "Student",
      }),
    );
    await asRole("anon", "", uni(at("15:30", 2), { service: LONG, total: 12, name: "Student 2" }));
    expect(
      (
        await asOwner(
          "select name, price::text, meeting_area, meeting_point from public.bookings where kind = 'university' order by slot_start",
        )
      ).rows,
    ).toEqual([
      { name: "Student", price: "5.00", meeting_area: "UIS", meeting_point: "Dewan A" },
      { name: "Student 2", price: "12.00", meeting_area: "UIS", meeting_point: "Dewan A" },
    ]);
    expect(
      (
        await asRole(
          "anon",
          "",
          "select * from public.booking_directions('33333333-3333-4333-8333-333333333333')",
        )
      ).rows,
    ).toEqual([{ address: "Dewan A", maps_url: "" }]);
  });
  it("moving the meeting point keeps what each customer booked", async () => {
    await asOwner(
      `update public.university_visits set meeting_point = 'Dewan B' where id = '${VISIT}'`,
    );
    expect(
      (
        await asOwner(
          "select distinct meeting_point from public.bookings where kind = 'university'",
        )
      ).rows,
    ).toEqual([{ meeting_point: "Dewan A" }]);
  });
  it("edits that would strand a booking are blocked; pausing keeps bookings", async () => {
    await expect(
      asOwner(
        `update public.university_visits set starts_at = ${at("16:00", 2)}, reserved_from = ${at("15:30", 2)} where id = '${VISIT}'`,
      ),
    ).rejects.toThrow(/clashes/);
    await asOwner(`update public.university_visits set is_open = false where id = '${VISIT}'`);
    await expect(
      asRole("anon", "", book(at("16:30", 2), { kind: "university", visit: VISIT, total: 5 })),
    ).rejects.toThrow(/available time/);
    expect(
      (await asOwner("select count(*)::int as n from public.bookings where kind = 'university'"))
        .rows,
    ).toEqual([{ n: 2 }]);
    // A visit with bookings cannot be deleted; its bookings must be resolved first.
    await expect(
      asOwner(`delete from public.university_visits where id = '${VISIT}'`),
    ).rejects.toThrow(/foreign key/);
  });
  it("an open visit needs the owner's WhatsApp number", async () => {
    await asOwner(`update public.university_visits set is_open = true where id = '${VISIT}'`);
    await expect(asOwner("update public.shop_settings set whatsapp_number = ''")).rejects.toThrow(
      /WhatsApp/,
    );
    await asOwner(`update public.university_visits set is_open = false where id = '${VISIT}'`);
    await asOwner("update public.shop_settings set whatsapp_number = ''");
    await expect(
      asOwner(`update public.university_visits set is_open = true where id = '${VISIT}'`),
    ).rejects.toThrow(/WhatsApp/);
    await asOwner("update public.shop_settings set whatsapp_number = '601157878404'");
  });
  it("visitors cannot change the catalogue", async () => {
    for (const sql of [
      "update public.services set shop_price = 0",
      "update public.house_call_areas set name = 'Hacked'",
      "update public.extra_charges set amount = 1",
    ]) {
      await expect(asRole("anon", "", sql)).rejects.toThrow(/permission denied/);
      expect((await asRole("authenticated", stranger, `${sql} returning *`)).rows).toHaveLength(0);
    }
  });
});

describe("owner controls", () => {
  it("only the owner can cancel", async () => {
    await expect(asRole("anon", "", "delete from public.bookings")).rejects.toThrow();
    expect(
      (await asRole("authenticated", stranger, "delete from public.bookings returning id")).rows,
    ).toHaveLength(0);
    const before = (await asOwner("select count(*)::int as n from public.bookings")).rows[0];
    expect((await asOwner("delete from public.bookings returning id")).rows).toHaveLength(
      (before as { n: number }).n,
    );
  });
  it("seeded hours close at midnight", async () => {
    const rows = (await db.query("select close_time::text from public.weekly_hours")).rows;
    expect(rows).toHaveLength(7);
    expect(rows.every((row) => (row as { close_time: string }).close_time === "00:00:00")).toBe(
      true,
    );
  });
});
