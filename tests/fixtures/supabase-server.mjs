/** TEST ONLY. A small Supabase HTTP stand-in backed by real in-memory Postgres.
 * It simulates Auth and the REST subset used by this app, so browser tests can
 * exercise actual Server Actions and RLS without cloud credentials. Never deploy
 * this server or use its fake credentials for a real shop. */
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
// The local preview can set its own owner password via .env.local; tests use the default.
const ownerPassword = process.env.LOCAL_OWNER_PASSWORD || "test-password-only";
const user = {
  id: owner,
  email: "owner@example.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: owner, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 86400, iat: Math.floor(Date.now() / 1000) })}.test-signature`;
await db.exec(`create role anon; create role authenticated; create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to anon,authenticated;
  grant execute on function auth.uid() to anon,authenticated;
  insert into auth.users values ('${owner}');
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;`);
for (const name of readdirSync("supabase/migrations").sort())
  await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
await db.exec(readFileSync("supabase/seed.sql", "utf8"));
await db.exec(`insert into private.shop_owner(user_id) values ('${owner}');`);

// Whitelist SQL identifiers even in test tooling. Values are always parameters.
const tables = {
  shop_settings: [
    "id",
    "name",
    "description",
    "address",
    "maps_url",
    "whatsapp_number",
    "logo_url",
    "timezone",
    "currency",
    "is_available",
    "unavailable_until",
    "unavailable_note",
    "updated_at",
  ],
  weekly_hours: ["day_of_week", "is_open", "open_time", "close_time", "break_start", "break_end"],
  services: ["id", "name", "price", "duration_minutes", "is_active", "sort_order"],
  earnings: ["id", "amount", "note", "payment_method", "business_date", "created_at"],
  bookings: ["id", "slot_start", "name", "phone", "area", "address", "note", "created_at"],
};
function field(table, name) {
  if (!tables[table]?.includes(name)) throw new Error("Unknown field");
  return `"${name}"`;
}

const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }
  const url = new URL(req.url, "http://127.0.0.1:54329");
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const signedIn = req.headers.authorization === `Bearer ${token}`;
  const send = (status, value) => {
    res.statusCode = status;
    res.end(JSON.stringify(value));
  };
  try {
    if (url.pathname === "/health") return send(200, { ok: true });
    if (url.pathname === "/test/reset") {
      await db.exec(
        "delete from public.bookings; delete from public.earnings; delete from public.services; delete from public.weekly_hours; delete from public.shop_settings;",
      );
      await db.exec(readFileSync("supabase/seed.sql", "utf8"));
      return send(200, { ok: true });
    }
    if (url.pathname === "/auth/v1/token") {
      if (body.email !== user.email || body.password !== ownerPassword)
        return send(400, {
          error: "invalid_grant",
          error_description: "Invalid login credentials",
        });
      return send(200, {
        access_token: token,
        token_type: "bearer",
        expires_in: 86400,
        refresh_token: "test-refresh-only",
        user,
      });
    }
    if (url.pathname === "/auth/v1/user")
      return signedIn ? send(200, user) : send(401, { msg: "Invalid JWT" });
    if (url.pathname === "/auth/v1/logout") return send(200, {});
    const table = url.pathname.replace("/rest/v1/", "");
    const response = await db.transaction(async (tx) => {
      await tx.exec(
        `set local role ${signedIn ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub','${signedIn ? owner : ""}',true);`,
      );
      if (table === "rpc/is_shop_owner")
        return (await tx.query("select public.is_shop_owner() as value")).rows[0].value;
      if (table === "rpc/booking_directions")
        return (
          await tx.query("select to_jsonb(t) as value from public.booking_directions($1) t", [
            body.booking_id,
          ])
        ).rows.map((row) => row.value);
      if (table === "rpc/daily_earnings_totals")
        return (
          await tx.query(
            "select to_jsonb(t) as value from public.daily_earnings_totals() t order by business_date desc",
          )
        ).rows.map((row) => row.value);
      if (!tables[table]) throw new Error("Unknown table");
      const args = [];
      const clauses = [];
      for (const [key, value] of url.searchParams) {
        if (["select", "order", "offset", "limit", "on_conflict"].includes(key)) continue;
        const [op] = value.split(".", 1);
        const sign = { eq: "=", gte: ">=", lt: "<" }[op];
        if (!sign) throw new Error("Unsupported filter");
        args.push(value.slice(op.length + 1));
        clauses.push(`${field(table, key)} ${sign} $${args.length}`);
      }
      const where = clauses.length ? ` where ${clauses.join(" and ")}` : "";
      let sql;
      if (req.method === "GET") {
        const selected = url.searchParams.get("select") || "*";
        const columns =
          selected === "*"
            ? "*"
            : selected
                .split(",")
                .map((key) => field(table, key))
                .join(",");
        const order = (url.searchParams.get("order") || "")
          .split(",")
          .filter(Boolean)
          .map((part) => {
            const [key, direction] = part.split(".");
            return `${field(table, key)} ${direction === "desc" ? "desc" : "asc"}`;
          });
        sql = `select to_jsonb(t) as value from (select ${columns} from public.${table}${where}${order.length ? ` order by ${order.join(",")}` : ""} limit ${Math.min(1000, Number(url.searchParams.get("limit") || 1000))} offset ${Number(url.searchParams.get("offset") || 0)}) t`;
      } else if (req.method === "POST") {
        const entries = Object.entries(body);
        const keys = entries.map(([key]) => field(table, key));
        const values = entries.map(([, value]) => {
          args.push(value);
          return `$${args.length}`;
        });
        const pk = table === "weekly_hours" ? "day_of_week" : "id";
        const upsert = String(req.headers.prefer).includes("resolution=merge-duplicates")
          ? ` on conflict (${pk}) do update set ${keys
              .filter((key) => key !== `"${pk}"`)
              .map((key) => `${key}=excluded.${key}`)
              .join(",")}`
          : "";
        const insert = `insert into public.${table} (${keys.join(",")}) values (${values.join(",")})${upsert}`;
        // Like PostgREST's return=minimal: no RETURNING unless a select was requested,
        // so anon can insert bookings it is not allowed to read back.
        sql = url.searchParams.has("select")
          ? `with changed as (${insert} returning *) select to_jsonb(changed) as value from changed`
          : `${insert} returning null as value`;
      } else if (req.method === "PATCH") {
        const sets = Object.entries(body).map(([key, value]) => {
          args.push(value);
          return `${field(table, key)}=$${args.length}`;
        });
        sql = `with changed as (update public.${table} set ${sets.join(",")}${where} returning *) select to_jsonb(changed) as value from changed`;
      } else if (req.method === "DELETE")
        sql = `with changed as (delete from public.${table}${where} returning *) select to_jsonb(changed) as value from changed`;
      else throw new Error("Unsupported method");
      const rows = (await tx.query(sql, args)).rows.map((row) => row.value);
      return req.headers.accept?.includes("vnd.pgrst.object") ? rows[0] : rows;
    });
    send(200, response);
  } catch (error) {
    send(error.code === "23505" ? 409 : 400, {
      message: error.message,
      code: error.code || "TEST_ERROR",
    });
  }
});
server.listen(54329, "127.0.0.1", () =>
  console.log("Test Supabase stand-in: http://127.0.0.1:54329"),
);
