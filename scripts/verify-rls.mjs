// Run against your OWN configured Supabase project after adding an earnings entry.
// No owner password or privileged key is used: this is exactly a logged-out client.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Fill in .env.local first; see README.md.");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const profile = await db.from("shop_settings").select("name").eq("id", 1).single();
if (profile.error) throw new Error(`Public profile check failed: ${profile.error.message}`);
const address = await db.from("shop_settings").select("address,maps_url");
if (!address.error)
  throw new Error("SECURITY FAILURE: logged-out users can read the shop address!");
const earnings = await db.from("earnings").select("*");
if (earnings.error) throw new Error(`Could not verify RLS: ${earnings.error.message}`);
if (earnings.data.length) throw new Error("SECURITY FAILURE: a logged-out user can read earnings!");
const totals = await db.rpc("daily_earnings_totals");
if (!totals.error) throw new Error("SECURITY FAILURE: public callers can execute earnings totals!");
const slots = await db.from("bookings").select("slot_start,slot_end");
if (slots.error) throw new Error(`Booked times should be public: ${slots.error.message}`);
const customers = await db.from("bookings").select("name,phone,address,total");
if (!customers.error)
  throw new Error("SECURITY FAILURE: logged-out users can read booking details!");
const visits = await db.from("university_visits").select("starts_at,area_label");
if (visits.error) throw new Error(`Uni visits should be public: ${visits.error.message}`);
const points = await db.from("university_visits").select("meeting_point,map_url");
if (!points.error)
  throw new Error("SECURITY FAILURE: logged-out users can read exact meeting points!");
// Aimed at an id that cannot exist, so this check never changes data even if it got through.
const prices = await db
  .from("services")
  .update({ shop_price: 0 })
  .eq("id", "00000000-0000-4000-8000-000000000000");
if (!prices.error) throw new Error("SECURITY FAILURE: logged-out users may write prices!");
console.log(
  "PASS: public shop is readable without its address, anonymous earnings return zero rows, the totals function is denied, bookings expose times only, uni meeting points stay private, and prices cannot be changed.",
);
console.log(
  "For a meaningful live check, first confirm the owner dashboard contains at least one saved entry.",
);
