-- Hosted Supabase grants anon/authenticated ALL privileges on every new public table.
-- Booking privacy relies on column grants (visitors may read slot_start only), so
-- remove those defaults and grant back exactly what the app needs.
revoke all on public.bookings from anon, authenticated;
grant insert (id, slot_start, name, phone, area, address, note) on public.bookings to anon, authenticated;
grant select (slot_start) on public.bookings to anon;
grant select, delete on public.bookings to authenticated;
